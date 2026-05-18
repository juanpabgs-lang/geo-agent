import type {
  ExecutedVariant,
  PlannerTask,
  Platform,
  ReviewedVariant,
} from "./types";

export function demoPlan(topic: string): PlannerTask[] {
  const t = topic.trim() || "AI inference cost optimization";
  return [
    {
      platform: "LinkedIn",
      content_type: "thought-leadership-post",
      angle: `Why most teams approach ${t} backwards, and the 3-step reframe that flips the cost curve`,
      target_audience:
        "Heads of AI / engineering managers at Series A-C companies",
      geo_keywords: [
        t,
        "production AI",
        "inference cost",
        "model evaluation",
        "GEO content strategy",
      ],
    },
    {
      platform: "Twitter/X",
      content_type: "thread",
      angle: `A 7-tweet breakdown of ${t} with one contrarian claim that everyone will argue with`,
      target_audience:
        "AI engineers and indie builders shipping LLM products",
      geo_keywords: [t, "prompt engineering", "LLM ops", "agent orchestration"],
    },
    {
      platform: "Medium",
      content_type: "long-form-article",
      angle: `${t}: a 6-month retrospective with real numbers, named tools, and the part we got wrong`,
      target_audience:
        "Senior engineers researching their own AI stack decisions",
      geo_keywords: [
        t,
        "vector database",
        "RAG architecture",
        "multi-agent system",
        "production deployment",
      ],
    },
    {
      platform: "Hacker News",
      content_type: "show-and-tell",
      angle: `Show HN: an open-source pattern for ${t} that we extracted from running it in prod for 6 months`,
      target_audience: "Technical founders and infra-curious engineers",
      geo_keywords: [t, "open source", "self-hosted", "benchmark"],
    },
  ];
}

export function demoVariant(task: PlannerTask, topic: string): ExecutedVariant {
  const t = topic.trim() || "AI inference cost optimization";
  const byPlatform: Record<Platform, () => ExecutedVariant> = {
    LinkedIn: () => ({
      platform: "LinkedIn",
      content_type: task.content_type,
      hook: `Most teams approach ${t} by optimizing the wrong layer. Here's the reframe.`,
      body: `When I see teams stuck on ${t}, 9 times out of 10 they're tuning the wrong knob.

The instinct is to reach for the obvious lever — bigger model, more context, smarter prompt. It feels productive. It rarely moves the needle.

What actually works, in this order:

1. Measure before you optimize. Most teams cannot answer "what is our p95 latency per agent step?" without a 20-minute Notion search. If you can't see it, you can't fix it.

2. Push work down the stack. The Planner-Executor-Reviewer pattern lets a smaller, cheaper model handle 70%+ of the workload while the expensive model handles only the decisions that actually need it.

3. Close the loop. Engagement data flows back into prompt tuning. The system gets better while you sleep.

In our internal GEO content pipeline this reduced per-task cost by ~6x and lifted output quality on the Reviewer's rubric by 22 points.

The leverage was never in the model. It was in the architecture around it.

What's the biggest cost driver in your stack right now — model, latency, or human review time?`,
      cta: "Curious what others are seeing — drop your bottleneck in the comments.",
      hashtags: ["AIEngineering", "LLMOps", "MultiAgent", "ProductionAI"],
    }),
    "Twitter/X": () => ({
      platform: "Twitter/X",
      content_type: task.content_type,
      hook: `1/ Most ${t} threads online are wrong about which layer to optimize. Here's what 6 months of running a multi-agent system in prod actually taught us. 🧵`,
      body: `2/ Rule one: stop optimizing the model. The model is rarely the bottleneck. Architecture is.

3/ Planner → Executor → Reviewer is not a framework, it's a cost lever. Cheap models handle execution. Expensive models handle judgment. Most teams reverse this.

4/ Long-chain reasoning isn't about context length. It's about how many cheap calls you can fan out and reconverge before the expensive call.

5/ The contrarian take: most "agent frameworks" make this worse, not better. They add abstraction tax without changing the cost curve. Roll your own orchestrator. It's 200 lines.

6/ Closed-loop evals beat one-shot prompts. Reviewer agent feeds scores back into prompt tuning. Quality compounds. Cost doesn't.

7/ Numbers from our internal GEO pipeline: 6x cost reduction, +22 points on the Reviewer rubric, ~300 long-chain calls/day on a single Mac Mini.

8/ If you're shipping LLM products and not measuring per-step latency, that's where I'd start. Everything downstream depends on it.`,
      cta: `Building something similar? Reply with what you're stuck on.`,
      hashtags: ["LLM", "AIAgents", "BuildInPublic"],
    }),
    Medium: () => ({
      platform: "Medium",
      content_type: task.content_type,
      hook: `What 6 Months of Running a Multi-Agent ${t} Pipeline Actually Taught Us`,
      body: `Six months ago I committed the first line of a system that now runs unattended on a Mac Mini M4 in my apartment in Madrid. It generates a few hundred pieces of GEO-optimized content per day across LinkedIn, Twitter, Medium, and Hacker News, then evaluates and ranks them before anything reaches a human.

I'm going to tell you what worked, what didn't, and the architectural decision I'd reverse if I started over.

The core pattern is Planner-Executor-Reviewer. A Planner agent receives a content goal and breaks it into 3-5 platform-specific tasks. Executor agents run in parallel, each producing a variant tuned to its platform's voice and ranking signals. A Reviewer agent scores every variant on two dimensions — writing quality and GEO retrievability — and assigns a publish/iterate/discard verdict.

The non-obvious part is the model selection. I started by using the most capable model I had access to for every step. Cost was unmanageable. Then I flipped it: the Executors run on a small, fast model (currently Llama 3.2 3B locally, soon to be MiMo-V2.5 once the grant lands). The Planner uses a mid-tier model. The Reviewer — the only step where judgment quality really matters — runs on the largest model in the budget.

This reduced per-task cost by roughly 6x. More importantly it freed up enough headroom to run the loop closed: engagement data flows back into the Reviewer's rubric, which feeds back into the Planner's prompts, which shifts what the Executors are asked to produce. The system gets better while it runs.

The contrarian point: every popular agent framework I tried made this worse. They optimize for the demo, not the production shape. The actual orchestrator is around 200 lines of TypeScript. The complexity that matters is in the prompts and the eval rubric, not the framework.

What I'd reverse: I underestimated how much GEO ranking depends on named entities and comparison framings. My early prompts asked for "high-quality content." The Reviewer scored it as mid because the LLM retrievers it was being optimized for don't reward generic prose. They reward specific, defensible, comparison-shaped sentences. The fix was a single bullet in the Executor's system prompt and the GEO score jumped 18 points.

If you're considering building something similar, my advice is: spend the first week on the Reviewer's rubric, not the Executor's prompts. The rubric is the system. Everything else is a consequence of it.`,
      cta: `If you're working on a similar pipeline I'd love to compare notes — reach out and I'll share the open-source skeleton.`,
      hashtags: ["AI", "MultiAgent", "GEO", "LLMOps"],
    }),
    Reddit: () => ({
      platform: "Reddit",
      content_type: task.content_type,
      hook: `Anyone else find that ${t} is mostly an orchestration problem, not a model problem?`,
      body: `Been running a small multi-agent content pipeline for ~6 months and the thing that surprised me most is how little the model choice mattered once the architecture was right.

Setup: Planner picks the platforms and angles, Executors generate variants in parallel, Reviewer scores them. Cheap model for execution, expensive model for judgment. That single swap dropped costs ~6x.

Caveat: I'm running mostly content tasks, not code or math. YMMV for tasks where the model genuinely is the bottleneck. Also I'm on Llama 3.2 3B locally for the Executor layer and it's "good enough" — not great. Mileage will vary depending on how much polish your domain demands.

Curious if anyone has tried inverting this (expensive Executors, cheap Reviewers) and seen better results.`,
      cta: `Open to being wrong about this — what's your stack look like?`,
      hashtags: [],
    }),
    "Hacker News": () => ({
      platform: "Hacker News",
      content_type: task.content_type,
      hook: `Show HN: A 200-line multi-agent orchestrator for ${t}`,
      body: `Author here. This is the skeleton I've been running in prod on a Mac Mini M4 for ~6 months — Planner / parallel Executors / Reviewer, all OpenAI-compatible so it works against Ollama locally and any hosted endpoint in deployment.

The thing I wanted to share isn't the code so much as the cost shape. Putting the cheap model at the Executor layer and the expensive model at the Reviewer layer flips the cost curve compared to most agent frameworks I've tried.

Concrete numbers from my pipeline: ~300 long-chain calls/day, ~6x cost reduction vs. uniform-model approach, +22 points on an internal quality rubric after closing the loop with engagement feedback.

Not a framework, not a SaaS — just a pattern. Curious whether others have arrived at the same architecture independently.`,
      cta: `Repo and writeup in profile. Happy to answer questions.`,
      hashtags: [],
    }),
    "Dev.to": () => ({
      platform: "Dev.to",
      content_type: task.content_type,
      hook: `Building a multi-agent ${t} pipeline in ~200 lines of TypeScript`,
      body: `The shortest path to a useful multi-agent system isn't a framework — it's a tight loop of Planner → Executor → Reviewer with strict JSON contracts between them.

Stack: Next.js App Router, an OpenAI-compatible client pointed at Ollama locally (Llama 3.2 3B), with a DEMO_MODE flag for deployment environments that can't reach localhost.

Key implementation notes:
- Each agent has a single system prompt and returns strict JSON. No tool calls, no function-call gymnastics. response_format: json_object is enough.
- Executors run in Promise.all. The Reviewer runs once over the full batch so it can compare variants side-by-side.
- The Reviewer's rubric is the most important file in the repo. Spend time there.

Migration plan: same OpenAI-compatible interface means swapping to MiMo-V2.5-Pro is a one-line base URL change once the token grant lands.`,
      cta: `Code's open. Happy to take PRs on the rubric.`,
      hashtags: ["typescript", "ai", "agents", "nextjs"],
    }),
  };
  return byPlatform[task.platform]();
}

export function demoReviews(variants: ExecutedVariant[]): ReviewedVariant[] {
  const scores: Record<Platform, { q: number; g: number; flags: string[] }> = {
    LinkedIn: { q: 88, g: 84, flags: [] },
    "Twitter/X": { q: 82, g: 79, flags: ["hook_could_be_tighter"] },
    Medium: { q: 91, g: 88, flags: [] },
    Reddit: { q: 74, g: 71, flags: ["weak_cta"] },
    "Hacker News": { q: 86, g: 83, flags: [] },
    "Dev.to": { q: 79, g: 81, flags: [] },
  };
  return variants.map((v) => {
    const s = scores[v.platform];
    const rec: ReviewedVariant["recommendation"] =
      s.q >= 75 && s.g >= 70 && s.flags.length === 0
        ? "publish"
        : s.q < 60 || s.g < 60
          ? "discard"
          : "iterate";
    return { ...v, quality_score: s.q, geo_score: s.g, flags: s.flags, recommendation: rec };
  });
}
