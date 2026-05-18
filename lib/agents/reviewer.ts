import { chat, extractJson, type ChatMessage } from "../llm-client";
import type {
  ExecutedVariant,
  LLMConfig,
  PlannerTask,
  ReviewedVariant,
} from "../types";

const SYSTEM_PROMPT = `You are the REVIEWER agent inside a GEO content distribution system.

Your job: score each content variant on two dimensions and decide whether it should ship.

Scoring rubric (0-100 each, integers):

QUALITY_SCORE — purely about the writing:
- 90-100: publish-ready, distinctive voice, zero filler, ends with momentum
- 70-89: solid, minor edits would help
- 50-69: usable but generic or has structural problems
- 0-49: rewrite required

GEO_SCORE — about how this content will perform in LLM retrieval and classical SEO:
- 90-100: named entities, comparison framings, defensible specifics, structured for snippet extraction
- 70-89: keyword coverage good but weak on entities or comparisons
- 50-69: hits some keywords but reads as generic content
- 0-49: keyword-stuffed, hallucinated, or topically off-target

FLAGS — short strings naming concrete issues, e.g. "no_named_entity", "hook_too_long", "weak_cta", "platform_mismatch", "hashtag_overuse", "no_contrarian_point". Empty array = clean.

RECOMMENDATION:
- "publish" if quality_score >= 75 AND geo_score >= 70 AND no critical flags
- "iterate" if either score 60-74 or fixable flags exist
- "discard" if either score < 60 or platform_mismatch

Output STRICT JSON only, no prose:
{
  "reviews": [
    {
      "platform": string,           // must match the input variant's platform
      "quality_score": integer 0-100,
      "geo_score": integer 0-100,
      "flags": string[],
      "recommendation": "publish" | "iterate" | "discard"
    }
  ]
}

Return one review per variant, in the same order as the input.`;

export async function runReviewer(
  config: LLMConfig,
  topic: string,
  tasks: PlannerTask[],
  variants: ExecutedVariant[]
): Promise<ReviewedVariant[]> {
  const variantSummary = variants
    .map(
      (v, i) =>
        `--- Variant ${i + 1} (${v.platform}, ${tasks[i]?.content_type}) ---
GEO keywords required: ${(tasks[i]?.geo_keywords ?? []).join(", ") || "(none)"}
HOOK: ${v.hook}
BODY: ${v.body}
CTA: ${v.cta}
HASHTAGS: ${(v.hashtags ?? []).join(", ")}`
    )
    .join("\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Original content goal: ${topic}

Variants to review:

${variantSummary}

Return the JSON reviews now, one per variant, same order.`,
    },
  ];

  const raw = await chat(config, {
    messages,
    temperature: 0.3,
    response_format: "json",
  });
  const parsed = extractJson<{
    reviews: Array<{
      platform: string;
      quality_score: number;
      geo_score: number;
      flags: string[];
      recommendation: "publish" | "iterate" | "discard";
    }>;
  }>(raw);

  return variants.map((variant, i) => {
    const review = parsed.reviews?.[i];
    return {
      ...variant,
      quality_score: clampScore(review?.quality_score),
      geo_score: clampScore(review?.geo_score),
      flags: Array.isArray(review?.flags) ? review.flags : [],
      recommendation: review?.recommendation ?? "iterate",
    };
  });
}

function clampScore(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}
