# geo-agent

> Multi-agent GEO (Generative Engine Optimization) content distribution system.
> Planner → parallel Executors → Reviewer, with an OpenAI-compatible LLM client
> that runs locally on Ollama and is ready to swap to MiMo-V2.5 / V2.5-Pro.

---

## Project description

I am building an automated GEO (Generative Engine Optimization) content distribution
system using a multi-agent workflow.

**Core architecture:** a Planner agent breaks down content goals and distribution paths;
Executor agents handle content generation and platform-specific formatting for
SEO/LLM ranking; a Reviewer agent evaluates quality and adjusts strategy. The system
runs scheduled tasks on a Mac Mini M4 server, forming a closed loop:

```
Generate → Evaluate → Distribute → Feedback
```

Each cycle involves 150–300 long-chain tool calls with 20–40K average context per task.

**Current stack:** Claude for orchestration, GPT for content generation, DeepSeek
for bulk analysis, with multi-platform recommendation logic that auto-generates
content variants and runs A/B testing. The system processes engagement data to
reverse-optimize prompts.

**Migration plan:** move the code-agent components to **MiMo-V2.5-Pro** (1M context
+ 63.8% ClawEval Pass³ fits the orchestration loop) and use **MiMo-V2.5 omnimodal**
for image and voice content variants. The LLM client in this repo is OpenAI-compatible,
so the swap is a 2-line change in `.env.local` — see [MiMo migration](#mimo-migration).

Daily volume target: a few hundred auto-generated content pieces with ~5x productivity
gain over manual workflows. **Max Token Plan covers approximately one month of system runtime.**

---

## What's in this repo

This repo is the orchestrator skeleton — the Planner / Executor / Reviewer loop
in TypeScript, with a streaming UI that visualizes each agent as it runs.

```
lib/
  agents/
    planner.ts     # decomposes a content goal into 3-5 platform tasks
    executor.ts    # generates a platform-specific variant for one task
    reviewer.ts    # scores variants on quality + GEO retrievability
  llm-client.ts    # OpenAI-compatible chat() client (Ollama / MiMo / DEMO_MODE)
  demo-data.ts     # static fixtures for DEMO_MODE (used on Vercel)
  types.ts

app/
  api/generate/route.ts  # SSE orchestrator endpoint
  page.tsx               # live agent visualization UI
```

The full GEO system (engagement-data feedback loop, scheduled jobs on the
Mac Mini, multi-platform publishers) lives in a private repo; this is the
public, runnable core that proves out the architecture.

---

## Architecture

```
              ┌─────────────────────────┐
   topic ────▶│        PLANNER          │── tasks ──┐
              │  (1 LLM call, JSON-out) │           │
              └─────────────────────────┘           │
                                                    ▼
                              ┌─────────────────────────────────────┐
                              │         EXECUTORS (parallel)         │
                              │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
                              │  │ LI   │ │ X    │ │ Med  │ │ HN   │ │
                              │  └──────┘ └──────┘ └──────┘ └──────┘ │
                              └─────────────────────────────────────┘
                                                    │ variants
                                                    ▼
                              ┌─────────────────────────────────────┐
                              │              REVIEWER                │
                              │     quality_score · geo_score        │
                              │   recommendation: publish/iterate/-  │
                              └─────────────────────────────────────┘
                                                    │
                                                    ▼
                                          scored variants → UI
```

**Agent contracts:** every agent returns strict JSON. No tool calls, no
function-call gymnastics — `response_format: json_object` is enough. This keeps
the orchestrator under 100 lines and makes the swap to MiMo trivial.

**Streaming:** the orchestrator emits SSE events (`planner_start`, `executor_done`,
`reviewer_done`, etc.), so the UI can render each agent's progress in real time.

---

## Run locally

Prereqs: Node 20+, [Ollama](https://ollama.com), and a model:

```bash
brew install ollama
brew services start ollama
ollama pull llama3.2:3b
```

Then:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The status pill in the header should read
**Running on Ollama · llama3.2:3b**.

Enter a content goal and click **run pipeline**. You should see:

1. Planner emit 3–4 platform tasks
2. Executors light up in parallel and produce variants
3. Reviewer score every variant and recommend publish/iterate/discard

---

## DEMO_MODE (deployment)

Vercel can't reach `localhost:11434`, so the deployed build runs with `DEMO_MODE=true`
and returns realistic, hardcoded mock responses with the same JSON shape as the
real pipeline. The UI is identical in both modes — the only difference is the pill
in the header switches from `Running on Ollama` to `Demo Mode`.

Set in Vercel project env:

```
DEMO_MODE=true
```

---

## MiMo migration

Once the Xiaomi MiMo Orbit 100T token grant lands, swapping the orchestrator
backend is a 2-line change in `.env.local`:

```diff
- OLLAMA_BASE_URL=http://localhost:11434/v1
- LLM_MODEL=llama3.2:3b
+ OLLAMA_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
+ OLLAMA_API_KEY=<mimo-token-plan-key>
+ LLM_MODEL=mimo-v2.5-pro
```

Because `lib/llm-client.ts` only talks to OpenAI-compatible `/v1/chat/completions`,
no other code changes. The Planner / Executor / Reviewer prompts work unchanged.

For omnimodal content variants (image + voice), the Executor layer will fan out
to MiMo-V2.5 omnimodal for the platforms where multi-modal variants outperform
text-only (LinkedIn carousels, Twitter/X video, Reddit image posts).

---

## License

MIT.
