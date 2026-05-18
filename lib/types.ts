export type Platform =
  | "LinkedIn"
  | "Twitter/X"
  | "Medium"
  | "Reddit"
  | "Hacker News"
  | "Dev.to";

export type ContentType =
  | "thought-leadership-post"
  | "thread"
  | "long-form-article"
  | "discussion-starter"
  | "show-and-tell"
  | "tutorial";

export interface PlannerTask {
  platform: Platform;
  content_type: ContentType;
  angle: string;
  target_audience: string;
  geo_keywords: string[];
}

export interface ExecutedVariant {
  platform: Platform;
  content_type: ContentType;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
}

export interface ReviewedVariant extends ExecutedVariant {
  quality_score: number;
  geo_score: number;
  flags: string[];
  recommendation: "publish" | "iterate" | "discard";
}

export type StreamEvent =
  | { type: "planner_start"; topic: string }
  | { type: "planner_done"; tasks: PlannerTask[] }
  | { type: "executor_start"; idx: number; platform: Platform }
  | { type: "executor_done"; idx: number; variant: ExecutedVariant }
  | { type: "reviewer_start" }
  | { type: "reviewer_done"; variants: ReviewedVariant[] }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "log"; agent: string; message: string };

export interface LLMConfig {
  mode: "ollama" | "demo";
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}
