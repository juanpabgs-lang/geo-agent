import type { LLMConfig } from "./types";

export function getLLMConfig(): LLMConfig {
  // Explicit opt-in
  if (process.env.DEMO_MODE === "true") {
    return { mode: "demo" };
  }
  // Explicit opt-out (lets us force real LLM in CI or remote runtimes)
  const forceLive = process.env.FORCE_LIVE_LLM === "true";
  // Default behavior: any non-local serverless runtime (Vercel, AWS, etc.) can't
  // reach the Mac Mini's Ollama, so fall back to demo unless explicitly overridden.
  const onServerlessHost = Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY
  );
  if (onServerlessHost && !forceLive) {
    return { mode: "demo" };
  }
  return {
    mode: "ollama",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    model: process.env.LLM_MODEL ?? "llama3.2:3b",
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  response_format?: "json" | "text";
  max_tokens?: number;
}

export async function chat(
  config: LLMConfig,
  opts: ChatOptions
): Promise<string> {
  if (config.mode === "demo") {
    throw new Error(
      "chat() must not be called in demo mode — orchestrator should branch earlier"
    );
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    stream: false,
  };
  if (opts.response_format === "json") {
    body.response_format = { type: "json_object" };
  }
  if (opts.max_tokens) body.max_tokens = opts.max_tokens;

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`LLM call failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

export function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const arrStart = candidate.indexOf("[");
  let sliceStart = -1;
  if (start === -1) sliceStart = arrStart;
  else if (arrStart === -1) sliceStart = start;
  else sliceStart = Math.min(start, arrStart);
  if (sliceStart === -1) throw new Error("No JSON found in model output");
  const opener = candidate[sliceStart];
  const closer = opener === "{" ? "}" : "]";
  const sliceEnd = candidate.lastIndexOf(closer);
  if (sliceEnd === -1) throw new Error("Unterminated JSON in model output");
  const slice = candidate.slice(sliceStart, sliceEnd + 1);
  return JSON.parse(slice) as T;
}
