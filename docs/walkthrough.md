# 8-minute walkthrough — script & shot list

A timed script for recording the project demo. Each section has the talking
points and what to show on screen. Aim for clean transitions and let pauses
sit; ~8 minutes total.

## Before you record

- Tabs ready: the `/coach` page (`pnpm dev` running), the LangSmith project, the
  GitHub repo, the editor with key files pre-opened (`src/graph.ts`,
  `src/agents/supervisor/supervisor.node.ts`, `src/agents/nutrition/subgraph.ts`,
  `src/state.ts`).
- The DB migration is applied (`pnpm db:migrate`), the coach KB is seeded
  with your own corpus (`pnpm kb:seed` — the repo ships `kb-fixtures/`
  empty; see `kb-fixtures/README.md`), and
  `ANTHROPIC_API_KEY` (or `COACH_LLM_PROVIDER=google` + `GEMINI_API_KEY`) is
  set in `.env.local`.
- Pick one **cross-domain** demo question so the routing fan-out is visible. I
  use: *"I want to build muscle in my 60s — how should I combine eating and
  training?"*

---

## 0:00–0:45 — the problem (intro)

**Say:** "Most AI coaches use one prompt for everything. Ask a cross-domain
question — *should I train legs on six hours of sleep, and what should I eat
after?* — and a single agent has to be a nutrition expert, a strength expert,
and a recovery expert all at once. Quality suffers. This repo rebuilds that as
a supervisor with specialist subgraphs."

**Show:** the GitHub repo title; flip to the architecture diagram in
`docs/architecture.md`.

## 0:45–2:00 — the architecture

**Say:** "The supervisor classifies the question and routes to one or more
specialists. Each specialist has its own retrieval namespace, its own tools,
and its own structured finding with citations. They never read each other's
output — the synthesizer does that, fanning their findings back in."

**Show:** the top-level mermaid in `docs/architecture.md`, then scroll to the
specialist subgraph diagram (retrieve → assess → tools → compose).

## 2:00–3:30 — live demo (the money shot)

**Say:** "Here is the running app." Submit the demo question.

**Show:** the `/coach` page. As the stream arrives, point at:
- The **routing decision** appearing first, with a one-sentence rationale.
- The status row updating: "Consulting nutrition specialist… ✓", "Consulting
  workout specialist… ✓", then "Synthesizing answer… ✓" — these happen as
  events arrive over the NDJSON stream.
- The **synthesized answer** rendering in 2–3 paragraphs.
- The **citations** toggle — open it; point out that citations are grouped by
  agent, so you can see which specialist supports which claim.

## 3:30–5:00 — code tour: the supervisor

**Say:** "The supervisor returns a structured routing decision before any
specialist runs."

**Show:** [`src/agents/supervisor/routing.schema.ts`](../src/agents/supervisor/routing.schema.ts).
"Zod schema — agents, primary agent, per-specialist sub-questions, rationale.
An invalid route is unrepresentable."

**Show:** [`src/agents/supervisor/supervisor.node.ts`](../src/agents/supervisor/supervisor.node.ts).
"Claude with `withStructuredOutput` — no parsing, no `any`. Plus the
normalization step: dedupe agents and guarantee `primaryAgent` is one of them.
Schemas can't enforce cross-field invariants; the node does."

**Show:** [`src/graph.ts`](../src/graph.ts).
"The conditional edge returns an array — LangGraph fans out to the chosen
specialists in parallel, then fans in to the synthesizer."

## 5:00–6:00 — code tour: a specialist subgraph + state

**Show:** [`src/agents/nutrition/subgraph.ts`](../src/agents/nutrition/subgraph.ts).
"Each specialist is its own small graph: retrieve → assess (do I need a tool?)
→ tools (if so) → compose. Its state schema **has no `findings` channel**, so a
specialist physically cannot read another's output."

**Show:** [`src/state.ts`](../src/state.ts).
"Top-level state has a `findings` channel with an object-merge reducer.
Parallel specialists each write their own slot — the merge composes them.
Last-write-wins would drop one."

## 6:00–7:00 — the LangSmith trace

**Say:** "Every run traces to LangSmith. The supervisor decision and each
specialist subgraph show up as nested runs."

**Show:** the LangSmith project, open the trace for the demo question. Expand
the `centenarian-coach` root run; point to the supervisor's structured output,
the nutrition and workout subgraphs running in parallel, the tool calls inside
each, the synthesizer at the end. If a trace is pinned, mention it.

## 7:00–8:00 — wrap

**Say:** "The repo is a portfolio piece and a five-lesson course. The lessons
walk through the design decisions — when multi-agent pays, structured routing,
per-agent retrieval, state passing, and evals — and each ends with a
build-this-yourself exercise on a customer-support-desk example, so the
pattern transfers. The chat model is switchable: Claude or Gemini, an env
var apart, for A/B quality comparison. Recovery is the planned third
specialist; evals land in v2."

**Show:** `docs/lessons/README.md`, then back to the GitHub repo for the
sign-off shot.

---

## Recording tips

- Record at 1080p or higher; zoom the editor to ~140%.
- Speak slower than feels natural — the demo moves quickly on screen.
- One take is fine; the audience prefers honesty to polish.
- If a network/quota hiccup happens mid-demo, use the deterministic test as a
  fallback to show the graph wiring: `pnpm test` — the mocked wiring test
  exercises supervisor → fan-out → synthesizer offline.
