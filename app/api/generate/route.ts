import { NextRequest } from "next/server";
import { runPlanner } from "@/lib/agents/planner";
import { runExecutor } from "@/lib/agents/executor";
import { runReviewer } from "@/lib/agents/reviewer";
import { getLLMConfig } from "@/lib/llm-client";
import { demoPlan, demoReviews, demoVariant } from "@/lib/demo-data";
import type {
  ExecutedVariant,
  PlannerTask,
  ReviewedVariant,
  StreamEvent,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { topic } = (await req.json().catch(() => ({}))) as {
    topic?: string;
  };
  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return new Response(
      JSON.stringify({ error: "topic must be at least 3 chars" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const config = getLLMConfig();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        send({ type: "planner_start", topic });
        send({
          type: "log",
          agent: "planner",
          message: `Decomposing goal into platform-specific tasks (mode=${config.mode})`,
        });

        let tasks: PlannerTask[];
        if (config.mode === "demo") {
          await wait(900);
          tasks = demoPlan(topic);
        } else {
          tasks = await runPlanner(config, topic);
        }
        send({ type: "planner_done", tasks });

        const variants: ExecutedVariant[] = new Array(tasks.length);
        await Promise.all(
          tasks.map(async (task, idx) => {
            send({ type: "executor_start", idx, platform: task.platform });
            send({
              type: "log",
              agent: `executor[${idx}]`,
              message: `Generating ${task.content_type} for ${task.platform}`,
            });
            let variant: ExecutedVariant;
            if (config.mode === "demo") {
              await wait(700 + idx * 250);
              variant = demoVariant(task, topic);
            } else {
              variant = await runExecutor(config, topic, task);
            }
            variants[idx] = variant;
            send({ type: "executor_done", idx, variant });
          })
        );

        send({ type: "reviewer_start" });
        send({
          type: "log",
          agent: "reviewer",
          message: `Scoring ${variants.length} variants across quality + GEO dimensions`,
        });

        let reviewed: ReviewedVariant[];
        if (config.mode === "demo") {
          await wait(800);
          reviewed = demoReviews(variants);
        } else {
          reviewed = await runReviewer(config, topic, tasks, variants);
        }
        send({ type: "reviewer_done", variants: reviewed });
        send({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET() {
  const config = getLLMConfig();
  return new Response(
    JSON.stringify({
      mode: config.mode,
      model: config.mode === "ollama" ? config.model : "demo-mock",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
