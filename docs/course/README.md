# Domain-Specialist Multi-Agent with Per-Agent RAG

A LangChain Academy **Project** course. You build one artifact end to end: the
**Centenarian Coach** — a LangGraph supervisor that routes a question to domain
specialists (nutrition, workout, recovery), where **each specialist owns its own
retrieval namespace** and every answer carries citations grounded in that
specialist's corpus.

It is the first project-tier course to teach **per-agent RAG**. Most multi-agent
courses share one global tool/retrieval set; here, isolation is the whole point,
and the health/longevity domain makes the **citation-grounding discipline**
load-bearing: an ungrounded but fluent answer is a liability, so grounding is
measured, not assumed.

## How to take this course

- **Read alongside the repo.** Every lesson names the exact files it touches.
- **Check out any lesson's starting state.** The branch carries one tagged commit
  per lesson: `git checkout course/lesson-04` lands you at the first-run smoke
  test, ready to run.
- **Open the traces.** Each lesson pins a LangSmith run you can open and inspect.
- **One artifact.** Every lesson contributes to the same coach. There is no
  separate transfer exercise on an unrelated domain — exercises extend the coach
  itself.
- **Citations.** Each lesson ends with an APA-7 `## References` section mixing
  primary literature with vendor documentation; on-screen claims in the video
  inherit those references.

## Outline — 6 modules, 28 lessons (~2.5 hr video)

### Module 0 · Setup + scope — *live*
1. [Course overview & the single-artifact promise](./module-0-setup/01-course-overview.md) — `course/lesson-01`
2. [Getting set up (TypeScript)](./module-0-setup/02-getting-set-up-typescript.md) — `course/lesson-02`
3. [Getting set up (Python) + language-translation table](./module-0-setup/03-getting-set-up-python.md) — `course/lesson-03`
4. [First-run smoke test](./module-0-setup/04-first-run-smoke-test.md) — `course/lesson-04`

### Module 1 · The supervisor — *in progress*
Single vs. multi-agent · the Zod routing schema · the topology-enforces-ordering
rule · conditional fan-out + temperature-0 classification.

### Module 2 · Specialist #1: Nutrition — *in progress*
Per-agent retrieval namespacing · the embedding-consistency trap · building the
first specialist subgraph · the type-enforced "can't read other specialists'
findings" trick.

### Module 3 · Specialists #2 + #3: Workout + Recovery — *in progress*
Adding Workout (the pattern repeats) · adding Recovery + subgraph isolation ·
state passing and fan-in.

### Module 4 · LangSmith evaluation — *in progress*
What to evaluate · deterministic evaluators (routing + citation) · the LLM-judge
grounding evaluator · running evals in LangSmith · the find-bug → add-example →
re-run loop on a growing dataset.

### Module 5 · Deployment + multi-tenant — *in progress*
LangGraph Platform deployment · per-user state · auth on the live coach ·
cost/latency dashboards.

### Module 6 · Extension launching pad — *in progress*
How to add a new specialist (worked with the `corrective` agent) · 3–5 extensions
with starting file paths · extending the eval suite · capstone.

---

> **Status.** Module 0 lessons are authored; Modules 1–6 are being written on the
> `feat/langchain-academy-project-refactor` branch, decomposed and expanded from
> the repo's original five lessons in [`../lessons/`](../lessons/). The video
> production package lives in [`../video/`](../video/).
