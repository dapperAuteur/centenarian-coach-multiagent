# Course video, script blueprint

> ✍️ **The verbatim narration AND the explicit screen-recording description are
> written LAST**, module by module, after each module's lesson prose is authored
> and approved, together, in one per-module pass. This file is the **blueprint**:
> the per-lesson script template, the runtime budget, and a coverage checklist
> derived from the approved lesson plan. Writing the words and the shot list
> against finalized lessons keeps both matched to the shipped course and avoids
> re-records. See [`README.md`](./README.md) for why;
> [`production-guide.md`](./production-guide.md) for how it's recorded.

## Written scripts (in `scripts/`)

The lessons are final, so the verbatim scripts are now being written, sample-first
for tone approval before the rest:

- [`scripts/00-intro-and-outro.md`](./scripts/00-intro-and-outro.md), on-camera intro
  (also the landing-page embed) + outro. **Written.**
- [`scripts/module-0.md`](./scripts/module-0.md), lessons 1 to 4, verbatim narration
  + shot-by-shot screen-recording directions. **Written.**
- [`scripts/module-1.md`](./scripts/module-1.md), the supervisor (lessons 5 to 8). **Written.**
- [`scripts/module-2.md`](./scripts/module-2.md), Nutrition specialist (lessons 9 to 12). **Written.**
- [`scripts/module-3.md`](./scripts/module-3.md), Workout + Recovery (lessons 13 to 15). **Written.**
- `scripts/module-4.md` through `scripts/module-6.md`, **pending**, authored module
  by module against the final lessons (same beginner-friendly, em-dash-free format).

The template, runtime budget, and coverage checklist below are what each
`scripts/module-N.md` is filled from.

## Script-writing workflow (per module)

1. The module's lessons in [the course](../README.md) are authored + approved.
2. For each lesson, fill the **template** below from the lesson's prose and its
   `## References` (on-screen citations must match).
3. Record against that lesson's **`git checkout course/lesson-NN`** state so the
   on-screen code is exactly the lesson's starting point.
4. Keep each script within its **runtime budget** (table below). If a draft runs
   long, cut narration, not the demo, the demo + trace are the payoff.

## Per-lesson script template

Each finished lesson gets BOTH columns below, written in the same pass: the
narration (what's said) and the screen-recording description (what's shown,
shot by shot). They are numbered so the editor can line audio against video.

```
LESSON mNN-lNN, <title>            [tag: course/lesson-NN] [budget: N min]

NARRATION
  [HOOK, 10–15s]      The failure or question this lesson resolves. One sentence.
  [WHY, 20–40s]       Why it matters for a multi-agent coach; the design tension.
  [CODE WALK]          Read the key lines aloud; name each file path. Mark every
                       claim needing an [on-screen cite: <source from lesson Refs>].
  [DEMO]               Narrate the run and the trace as they happen.
  [TAKEAWAY, 15–25s]  The one rule to remember. Restate it as a sentence.
  [BRIDGE, 5–10s]     One line pointing to the next lesson / the exercise.

SCREEN-RECORDING DESCRIPTION (shot list, written last, with the narration)
  0. Checkout state: `git checkout course/lesson-NN`; clean `git status`.
  1. <window>, <action>; zoom/highlight <file:line or UI element>.
  2. <terminal>, run `<exact command>`; expected on-screen result: <…>.
  3. <LangSmith>, open the run; expand <node path>; point at <snippet / metric>.
  …  one numbered shot per discrete on-screen action; mark speed-ramps (⏩) and
     callouts. Every file path / command here must exist at the lesson's tag.
```

On-camera bookends (intro/outro) use a shorter beat list, hook, promise, who
it's for (intro) / recap, launching-pad CTA, links to the sibling courses (outro)
, and are written last, after the full lesson set, so the promise matches what
shipped. Intro budget 1.5 min (doubles as the landing-page embed); outro 1 min.

---

## Coverage checklist (28 lessons)

Each row is the **seed material** a finished lesson writes from, objective,
what's on screen, the demo/trace, and the takeaway, pulled from the approved
lesson plan and the real repo paths. Once the lesson lands, the writer expands
each row into BOTH the narration and the explicit shot-by-shot screen-recording
description via the template above. The rows below are not the shot list; they
are what the shot list (written last) is built from.

### Module 0 · Setup + scope, `course/lesson-01..04` (15.5 min)

| Tag | Lesson | min | On-screen | Demo / trace | Takeaway |
|---|---|---|---|---|---|
| l-01 | Course overview & the single-artifact promise | 3.5 | repo tour, the 6-module map, the rubric-shaped promise | - | One coach, built end to end; per-agent RAG is the gap this fills. |
| l-02 | Getting set up (TypeScript) | 4 | clone, `pnpm install`, `.env.example`→`.env.local`, Neon URL, `pnpm db:migrate` | migration applies cleanly | The artifact runs locally before any architecture lesson. |
| l-03 | Getting set up (Python) + language-translation table | 3 | slide: TS↔Python LangGraph mapping (no parallel artifact) | - | Concepts transfer; this course's artifact stays TypeScript. |
| l-04 | First-run smoke test | 5 | `pnpm kb:seed`, `pnpm kb:status`, ask the supervisor a question | live answer + citations, then open the LangSmith trace | You have a working, observable coach in minute one. |

### Module 1 · The supervisor, `course/lesson-05..08` (22 min)

| Tag | Lesson | min | On-screen | Demo / trace | Takeaway |
|---|---|---|---|---|---|
| l-05 | Single-agent vs. multi-agent: when the complexity pays | 6 | the 4-point decision checklist; the routing-for-routing's-sake anti-pattern | single-agent vs supervisor answer, side by side | Earn the supervisor; don't add it reflexively. |
| l-06 | Designing the routing schema with Zod | 6 | `src/agents/supervisor/routing.schema.ts`, `supervisor.node.ts`, `withStructuredOutput` | trace: the structured routing decision before any specialist runs | A typed decision beats prose routing. |
| l-07 | The topology-enforces-ordering rule | 5 | `src/graph.ts` edges; `tests/topology.test.ts` | `pnpm test tests/topology.test.ts` green | Order is a structural guarantee, not prompt discipline. |
| l-08 | Conditional fan-out + temperature-0 as classification | 5 | `routeToSpecialists`, `addConditionalEdges`; temp-0 setting | trace: fan-out to N specialists in parallel | Routing is classification, pin it deterministic. |

### Module 2 · Specialist #1 (Nutrition), `course/lesson-09..12` (22 min)

| Tag | Lesson | min | On-screen | Demo / trace | Takeaway |
|---|---|---|---|---|---|
| l-09 | Per-agent retrieval namespacing | 6 | `src/db/schema.ts` `coachKb`, `match_coach_kb` SQL, `src/lib/pgvector.ts` | query one namespace, show isolation | One table, a `namespace` column = each specialist owns its corpus. |
| l-10 | The embedding-consistency trap | 5 | `src/lib/embeddings.ts` (768-dim, Gemini/Ollama) | mismatched-dim failure, then the fix | Seed and query must share one embedding space. |
| l-11 | Building the first specialist subgraph (Nutrition) | 7 | `src/agents/nutrition/subgraph.ts` retrieve→assess→compose, `retrieval.ts` | trace: nutrition finding with citations | A specialist is a small graph that retrieves from its own namespace. |
| l-12 | The type-enforced "can't read others' findings" trick | 4 | `src/state.ts` isolated annotation (no `findings` channel) | compile error when a specialist reaches for `findings` | Isolation by type, not by discipline. |

### Module 3 · Specialists #2+#3 (Workout + Recovery), `course/lesson-13..15` (18 min)

| Tag | Lesson | min | On-screen | Demo / trace | Takeaway |
|---|---|---|---|---|---|
| l-13 | Adding Workout (the pattern repeats) | 6 | `src/agents/workout/{subgraph,retrieval}.ts`, adapter node | trace: workout finding | The specialist shape is a template you stamp out. |
| l-14 | Adding Recovery + subgraph isolation | 6 | `src/agents/recovery/*`, separate state schema | trace: recovery finding | Separate state schemas keep parallel specialists from stomping. |
| l-15 | State passing & fan-in | 6 | `src/state.ts` `findings` object-merge reducer; `src/synthesizer/synthesize.ts` | trace: parallel findings merge → synthesizer | The reducer lets parallel writes merge without clobbering. |

### Module 4 · LangSmith evaluation, `course/lesson-16..20` (28 min)

| Tag | Lesson | min | On-screen | Demo / trace | Takeaway |
|---|---|---|---|---|---|
| l-16 | Why multi-agent systems fail quietly + what to evaluate | 5 | the three failure axes (routing / citation / grounding) | a confidently-wrong misroute | Decompose quality into independently-checkable scores. |
| l-17 | Deterministic evaluators: routing + citation | 6 | `evals/rubric.ts` `routingScore`/`citationScore`; `evals/dataset.json` | `pnpm eval` summary table | Cheap, pure-function gates catch the obvious regressions. |
| l-18 | The LLM-judge grounding evaluator | 7 | `evals/grounding.ts` (temp-0, Zod `{score, unsupportedClaims}`) | `RUN_GROUNDING=1 pnpm eval`; a flagged unsupported claim | Grounding needs a judge; pin it deterministic, give a tight rubric. |
| l-19 | Running evals in LangSmith | 6 | `evals/run-langsmith.ts` `pushDataset` + `evaluate()` | `pnpm eval:langsmith` → experiment URL in the dashboard | Same evaluators, now tracked + diffable across runs. |
| l-20 | The iteration loop (the growing dataset) | 4 | add an example with `addedIn`/`note` to `dataset.json`; re-run | new example fails, fix, passes; dataset grew | Find bug → add example → re-run. The dataset grows with the course. |

### Module 5 · Deployment + multi-tenant, `course/lesson-21..24` (22 min), *cloud steps gated on operator task 12*

| Tag | Lesson | min | On-screen | Demo / trace | Takeaway |
|---|---|---|---|---|---|
| l-21 | LangGraph Platform + `langgraph.json` + the deployment entry | 6 | `langgraph.json`, `src/deployment/graph.ts`; `npx @langchain/langgraph-cli dev` | local platform boot of the graph | A thin entry isolates the one import the Platform build must resolve. |
| l-22 | Deploying + env/DB wiring | 6 | Platform secrets UI; `DATABASE_URL` + seeded `coach_kb` + keys | deployed graph answers a question (gated) | The deployed graph needs its DB seeded in the same database. |
| l-23 | Per-user state + auth on the live coach | 5 | session/auth wiring; per-user namespaces | two users, isolated state | Multi-tenant = state + corpus isolation per user. |
| l-24 | Cost/latency dashboards | 5 | LangSmith dashboards; per-run cost/latency | a dashboard reading a week of runs | Observability is the deploy story, not an afterthought. |

### Module 6 · Extension launching pad, `course/lesson-25..28` (16 min)

| Tag | Lesson | min | On-screen | Demo / trace | Takeaway |
|---|---|---|---|---|---|
| l-25 | How to add a new specialist (worked: `corrective`) | 5 | `src/agents/corrective/*`, the registration in `src/graph.ts` | trace: a 4th specialist answering | The extension shape itself, copy the template, own a namespace, register. |
| l-26 | 3–5 named extensions + file paths + difficulty | 5 | a table: MCP tool, streaming, memory/checkpointer, multi-tenant corpora, each with a starting path | - | Concrete launching pads, not "now go build." |
| l-27 | Extending the eval suite as you extend the system | 3 | add specialist examples to `dataset.json`; a new evaluator | `pnpm eval` over the extended set | New capability ships with new evals. |
| l-28 | Capstone: ship your own specialist | 3 | recap the full arc; the checkout-any-lesson tag flow | - | You can now own a domain end to end. |

---

## Note on citations

This blueprint is production material, not curriculum, it carries no APA-7
`## References` of its own. The **verbatim narration** written from it inherits
each lesson's references: every `[on-screen cite: …]` cue in a finished script
must resolve to an entry in that lesson's `## References` section in
[the course](../README.md).
