"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PlannerTask,
  Platform,
  ReviewedVariant,
  StreamEvent,
} from "@/lib/types";

type AgentStatus = "idle" | "running" | "done";

interface ExecutorState {
  status: AgentStatus;
  platform?: Platform;
  variant?: ReviewedVariant;
}

const platformAccent: Record<Platform, string> = {
  LinkedIn: "border-sky-500/40 text-sky-300",
  "Twitter/X": "border-zinc-400/40 text-zinc-200",
  Medium: "border-emerald-500/40 text-emerald-300",
  Reddit: "border-orange-500/40 text-orange-300",
  "Hacker News": "border-amber-500/40 text-amber-300",
  "Dev.to": "border-violet-500/40 text-violet-300",
};

function accentFor(p: Platform | undefined): string {
  if (!p) return "border-zinc-700 text-zinc-300";
  return platformAccent[p] ?? "border-zinc-700 text-zinc-300";
}

const recommendationStyle: Record<
  ReviewedVariant["recommendation"],
  string
> = {
  publish: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  iterate: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  discard: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export default function Home() {
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"ollama" | "demo" | null>(null);
  const [model, setModel] = useState<string>("");
  const [plannerStatus, setPlannerStatus] = useState<AgentStatus>("idle");
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [executors, setExecutors] = useState<ExecutorState[]>([]);
  const [reviewerStatus, setReviewerStatus] = useState<AgentStatus>("idle");
  const [reviewed, setReviewed] = useState<ReviewedVariant[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/generate")
      .then((r) => r.json())
      .then((d: { mode: "ollama" | "demo"; model: string }) => {
        setMode(d.mode);
        setModel(d.model);
      })
      .catch(() => {
        setMode("demo");
        setModel("unknown");
      });
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  function pushLog(line: string) {
    const stamp = new Date().toISOString().split("T")[1]?.slice(0, 8) ?? "";
    setLogs((prev) => [...prev, `[${stamp}] ${line}`]);
  }

  function reset() {
    setPlannerStatus("idle");
    setTasks([]);
    setExecutors([]);
    setReviewerStatus("idle");
    setReviewed([]);
    setLogs([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || running) return;
    reset();
    setRunning(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.text();
        throw new Error(`Request failed: ${detail}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.replace(/^data:\s*/, "").trim();
          if (!line) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          applyEvent(evt);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  function applyEvent(evt: StreamEvent) {
    switch (evt.type) {
      case "planner_start":
        setPlannerStatus("running");
        pushLog(`PLANNER · received goal: "${evt.topic}"`);
        break;
      case "planner_done":
        setPlannerStatus("done");
        setTasks(evt.tasks);
        setExecutors(evt.tasks.map((t) => ({ status: "idle", platform: t.platform })));
        pushLog(`PLANNER · emitted ${evt.tasks.length} platform tasks`);
        break;
      case "executor_start":
        setExecutors((prev) => {
          const next = [...prev];
          next[evt.idx] = { ...next[evt.idx], status: "running", platform: evt.platform };
          return next;
        });
        pushLog(`EXECUTOR[${evt.idx}] · ${evt.platform} · generating`);
        break;
      case "executor_done":
        setExecutors((prev) => {
          const next = [...prev];
          next[evt.idx] = {
            ...next[evt.idx],
            status: "done",
            variant: { ...evt.variant, quality_score: 0, geo_score: 0, flags: [], recommendation: "iterate" },
          };
          return next;
        });
        pushLog(`EXECUTOR[${evt.idx}] · ${evt.variant.platform} · variant ready (${evt.variant.body.length} chars)`);
        break;
      case "reviewer_start":
        setReviewerStatus("running");
        pushLog(`REVIEWER · scoring variants`);
        break;
      case "reviewer_done":
        setReviewerStatus("done");
        setReviewed(evt.variants);
        evt.variants.forEach((v) => {
          pushLog(
            `REVIEWER · ${v.platform} · q=${v.quality_score} geo=${v.geo_score} → ${v.recommendation}`
          );
        });
        break;
      case "done":
        pushLog(`ORCHESTRATOR · loop complete`);
        break;
      case "log":
        pushLog(`${evt.agent.toUpperCase()} · ${evt.message}`);
        break;
      case "error":
        setError(evt.message);
        pushLog(`ERROR · ${evt.message}`);
        break;
    }
  }

  const modePill =
    mode === "ollama" ? (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Running on Ollama · {model}
      </span>
    ) : mode === "demo" ? (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Demo Mode · static fixtures
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-400 text-xs">
        detecting backend…
      </span>
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <header className="border-b border-zinc-800/80 backdrop-blur sticky top-0 z-10 bg-zinc-950/85">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center text-zinc-900 font-bold text-sm">
              G
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">geo-agent</div>
              <div className="text-[10px] text-zinc-500 tracking-wider uppercase">
                Multi-agent GEO distribution
              </div>
            </div>
          </div>
          {modePill}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <section>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
            Planner → Executor → Reviewer
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-2xl">
            Enter a content goal. The Planner agent decomposes it into platform-specific
            tasks, parallel Executor agents generate variants tuned for each platform,
            and the Reviewer agent scores them on writing quality and GEO retrievability.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="text-xs uppercase tracking-widest text-zinc-500">
            content goal
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. how multi-agent orchestration changes the cost curve for LLM products"
              disabled={running}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-4 py-3 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={running || !topic.trim()}
              className="px-5 py-3 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold tracking-tight transition-colors disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              {running ? "running…" : "run pipeline"}
            </button>
          </div>
        </form>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-6">
            <AgentStage
              label="01 · PLANNER"
              status={plannerStatus}
              description="Decomposes the goal into 3–5 platform-specific distribution tasks."
            >
              {tasks.length > 0 && (
                <ul className="space-y-2 text-xs">
                  {tasks.map((t, i) => (
                    <li
                      key={i}
                      className={`border ${accentFor(t.platform)} bg-zinc-900/50 rounded-md px-3 py-2`}
                    >
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                        <span className="font-semibold">{t.platform}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">{t.content_type}</span>
                      </div>
                      <div className="text-zinc-300 mt-1 leading-snug">{t.angle}</div>
                      <div className="text-zinc-500 mt-1 text-[11px]">
                        target: {t.target_audience}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AgentStage>

            <AgentStage
              label="02 · EXECUTORS"
              status={
                executors.length === 0
                  ? "idle"
                  : executors.every((e) => e.status === "done")
                    ? "done"
                    : executors.some((e) => e.status === "running")
                      ? "running"
                      : "idle"
              }
              description="Parallel workers, one per platform. Each produces a fully-formatted variant."
            >
              {executors.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {executors.map((e, i) => (
                    <div
                      key={i}
                      className={`rounded-md border p-2.5 text-center text-[11px] transition-colors ${
                        e.status === "running"
                          ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-300"
                          : e.status === "done"
                            ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                            : "border-zinc-800 bg-zinc-900/50 text-zinc-500"
                      }`}
                    >
                      <div className="font-semibold tracking-tight">
                        {e.platform ?? `executor[${i}]`}
                      </div>
                      <div className="text-[10px] mt-1 uppercase tracking-widest">
                        {e.status === "running" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            generating
                          </span>
                        ) : e.status === "done" ? (
                          "ready"
                        ) : (
                          "queued"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AgentStage>

            <AgentStage
              label="03 · REVIEWER"
              status={reviewerStatus}
              description="Scores every variant on writing quality + GEO retrievability and votes publish/iterate/discard."
            >
              {reviewed.length > 0 && (
                <div className="space-y-4">
                  {reviewed.map((v, i) => (
                    <article
                      key={i}
                      className={`border bg-zinc-900/60 rounded-lg ${accentFor(v.platform)}`}
                    >
                      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-semibold tracking-tight">
                            {v.platform}
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400">{v.content_type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <ScoreChip label="quality" value={v.quality_score} />
                          <ScoreChip label="geo" value={v.geo_score} />
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-widest ${recommendationStyle[v.recommendation]}`}
                          >
                            {v.recommendation}
                          </span>
                        </div>
                      </header>
                      <div className="px-4 py-3 space-y-2 text-xs leading-relaxed">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                            hook
                          </div>
                          <div className="text-zinc-100 font-medium">{v.hook}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                            body
                          </div>
                          <div className="text-zinc-300 whitespace-pre-wrap">
                            {v.body}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                            cta
                          </div>
                          <div className="text-zinc-300">{v.cta}</div>
                        </div>
                        {v.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {v.hashtags.map((h, j) => (
                              <span
                                key={j}
                                className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-400"
                              >
                                #{h}
                              </span>
                            ))}
                          </div>
                        )}
                        {v.flags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {v.flags.map((f, j) => (
                              <span
                                key={j}
                                className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/5 text-amber-300"
                              >
                                ⚑ {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </AgentStage>
          </div>

          <aside className="space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">
              orchestrator trace
            </div>
            <div
              ref={logRef}
              className="bg-black/60 border border-zinc-800 rounded-md p-3 h-[520px] overflow-y-auto text-[11px] leading-relaxed text-zinc-400"
            >
              {logs.length === 0 ? (
                <div className="text-zinc-600">waiting for input…</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="font-mono whitespace-pre-wrap">
                    {l}
                  </div>
                ))
              )}
            </div>
            {error && (
              <div className="text-xs text-rose-300 border border-rose-500/30 bg-rose-500/10 rounded-md p-3">
                {error}
              </div>
            )}
          </aside>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-zinc-800/80 mt-12 text-[11px] text-zinc-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div>
          Hugo Sanchez Production Node · Madrid · Mac Mini M4 (24GB)
        </div>
        <div className="text-zinc-600">
          Planner → Executor → Reviewer · OpenAI-compatible LLM client · MiMo-V2.5 ready
        </div>
      </footer>
    </div>
  );
}

function AgentStage({
  label,
  status,
  description,
  children,
}: {
  label: string;
  status: AgentStatus;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border border-zinc-800 rounded-lg bg-zinc-900/30 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
            {label}
          </span>
          <StatusDot status={status} />
        </div>
        <span className="text-[10px] text-zinc-600">
          {status === "running" ? "working…" : status === "done" ? "complete" : "idle"}
        </span>
      </header>
      <div className="px-4 py-4 space-y-3">
        <p className="text-[11px] text-zinc-500 leading-relaxed">{description}</p>
        {children}
      </div>
    </section>
  );
}

function StatusDot({ status }: { status: AgentStatus }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </span>
    );
  }
  if (status === "done") {
    return <span className="w-2 h-2 rounded-full bg-emerald-500/70" />;
  }
  return <span className="w-2 h-2 rounded-full bg-zinc-700" />;
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 80
      ? "border-emerald-500/40 text-emerald-300"
      : value >= 65
        ? "border-amber-500/40 text-amber-300"
        : "border-rose-500/40 text-rose-300";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-widest ${tone}`}
    >
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
