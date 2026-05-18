import { chat, extractJson, type ChatMessage } from "../llm-client";
import type { LLMConfig, PlannerTask } from "../types";

const SYSTEM_PROMPT = `You are the PLANNER agent inside a Generative Engine Optimization (GEO) content distribution system.

Your job: decompose a single content goal into 3-5 platform-specific distribution tasks. Each task is later executed by a downstream Executor agent and scored by a Reviewer agent.

A good plan satisfies these constraints:
1. PLATFORM DIVERSITY: pick platforms whose audiences and formats are genuinely different. Avoid two tasks that would produce near-identical output.
2. GEO RANKING SIGNAL: every task must specify geo_keywords that anchor the content for both classical SEO and LLM retrieval (entities, named concepts, comparison terms — not generic adjectives).
3. ANGLE SPECIFICITY: angle must be a concrete, defensible take, not a topic restatement. "Why X beats Y for use-case Z" is good; "The benefits of X" is not.
4. AUDIENCE TARGETING: target_audience names a specific role + seniority (e.g. "senior backend engineers at fintech startups"), not a demographic.

Output STRICT JSON only, with this exact schema (no prose, no markdown fences):
{
  "tasks": [
    {
      "platform": one of: "LinkedIn" | "Twitter/X" | "Medium" | "Reddit" | "Hacker News" | "Dev.to",
      "content_type": one of: "thought-leadership-post" | "thread" | "long-form-article" | "discussion-starter" | "show-and-tell" | "tutorial",
      "angle": string,
      "target_audience": string,
      "geo_keywords": string[]
    }
  ]
}

Pick 3 or 4 tasks. Quality > quantity.`;

export async function runPlanner(
  config: LLMConfig,
  topic: string
): Promise<PlannerTask[]> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Content goal: ${topic}\n\nReturn the JSON plan now.`,
    },
  ];
  const raw = await chat(config, {
    messages,
    temperature: 0.6,
    response_format: "json",
  });
  const parsed = extractJson<{ tasks: PlannerTask[] }>(raw);
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error("Planner returned empty task list");
  }
  return parsed.tasks.slice(0, 5).map(normalizeTask);
}

const ALLOWED_PLATFORMS: PlannerTask["platform"][] = [
  "LinkedIn",
  "Twitter/X",
  "Medium",
  "Reddit",
  "Hacker News",
  "Dev.to",
];

function normalizeTask(t: PlannerTask): PlannerTask {
  const raw = String(t.platform ?? "");
  const lower = raw.toLowerCase();
  let platform: PlannerTask["platform"] = "Medium";
  if (lower.includes("linkedin")) platform = "LinkedIn";
  else if (lower.includes("twitter") || lower.includes("x.com") || lower === "x") platform = "Twitter/X";
  else if (lower.includes("medium")) platform = "Medium";
  else if (lower.includes("reddit")) platform = "Reddit";
  else if (lower.includes("hacker") || lower.includes("hn")) platform = "Hacker News";
  else if (lower.includes("dev.to") || lower.includes("devto")) platform = "Dev.to";
  else {
    const match = ALLOWED_PLATFORMS.find((p) => p === raw);
    if (match) platform = match;
  }
  return {
    platform,
    content_type: t.content_type ?? "thought-leadership-post",
    angle: String(t.angle ?? "").trim() || "(no angle provided)",
    target_audience: String(t.target_audience ?? "").trim() || "general technical audience",
    geo_keywords: Array.isArray(t.geo_keywords)
      ? t.geo_keywords.map((k) => String(k)).filter(Boolean)
      : [],
  };
}
