import { chat, extractJson, type ChatMessage } from "../llm-client";
import type { ExecutedVariant, LLMConfig, PlannerTask } from "../types";

const SYSTEM_PROMPT = `You are an EXECUTOR agent inside a GEO content distribution system.

Your job: take ONE planned task and produce a single ready-to-publish content variant for that specific platform. You are not the Planner and you are not the Reviewer — do not second-guess the plan.

Platform-specific rules:
- LinkedIn: 1200-1800 chars, professional voice, line breaks every 1-2 sentences, no clickbait, ends with a question or signal.
- Twitter/X: thread of 5-8 numbered tweets, each <=270 chars, hook tweet must front-load the strongest claim.
- Medium: 600-900 word article-style body, with at least one named example and one contrarian point. Subheads optional but no markdown headers in the JSON string — use prose structure.
- Reddit: conversational, no marketing voice, explicit caveats, 400-700 chars. The hook is the title.
- Hacker News: factual, technical, link-bait-free. The hook is the title; body is "Show HN" or comment-style context.
- Dev.to: technical, code-friendly tone, 500-900 chars body, can reference libraries/tools by name.

For GEO ranking, weave the provided geo_keywords naturally into the body — at least 3 of them, never keyword-stuffed.

Output STRICT JSON only, with this exact schema (no prose, no markdown fences):
{
  "hook": string,         // title / opening line / first tweet
  "body": string,         // main content
  "cta": string,          // explicit call to action at the end
  "hashtags": string[]    // 0-5 platform-appropriate tags, no leading #
}`;

export async function runExecutor(
  config: LLMConfig,
  topic: string,
  task: PlannerTask
): Promise<ExecutedVariant> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Original content goal: ${topic}

Your task:
- Platform: ${task.platform}
- Content type: ${task.content_type}
- Angle: ${task.angle}
- Target audience: ${task.target_audience}
- GEO keywords to weave in: ${task.geo_keywords.join(", ")}

Produce the variant as JSON now.`,
    },
  ];
  const raw = await chat(config, {
    messages,
    temperature: 0.8,
    response_format: "json",
  });
  const parsed = extractJson<Omit<ExecutedVariant, "platform" | "content_type">>(
    raw
  );
  return {
    platform: task.platform,
    content_type: task.content_type,
    hook: coerceString(parsed.hook),
    body: coerceString(parsed.body),
    cta: coerceString(parsed.cta),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h) => String(h).replace(/^#/, ""))
      : [],
  };
}

function coerceString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => String(v)).join("\n\n");
  if (value == null) return "";
  return String(value);
}
