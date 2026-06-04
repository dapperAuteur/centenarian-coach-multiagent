# Domain-Specialist Multi-Agent with Per-Agent RAG

A LangChain Academy **Project** course. You build one artifact end to end:
**Fit T. Cent 3.0**, the Centenarian Coach, a LangGraph supervisor that routes a question to domain
specialists (nutrition, workout, recovery), where **each specialist owns its own
retrieval namespace** and every answer carries citations grounded in that
specialist's corpus (the set of documents that specialist can retrieve from).

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
  separate transfer exercise on an unrelated domain, exercises extend the coach
  itself.
- **Citations.** Each lesson ends with an APA-7 `## References` section mixing
  primary literature with vendor documentation; on-screen claims in the video
  inherit those references.

## Outline, 6 modules, 28 lessons (~2.5 hr video)

### Module 0 · Setup + scope, *live*
1. [Course overview & the single-artifact promise](./module-0-setup/01-course-overview.md), `course/lesson-01`
2. [Getting set up (TypeScript)](./module-0-setup/02-getting-set-up-typescript.md), `course/lesson-02`
3. [Getting set up (Python) + language-translation table](./module-0-setup/03-getting-set-up-python.md), `course/lesson-03`
4. [First-run smoke test](./module-0-setup/04-first-run-smoke-test.md), `course/lesson-04`

### Module 1 · The supervisor, *live*
5. [Single-agent vs. multi-agent: when the complexity pays](./module-1-supervisor/05-single-vs-multi-agent.md), `course/lesson-05`
6. [Designing the routing schema with Zod](./module-1-supervisor/06-routing-schema-zod.md), `course/lesson-06`
7. [The topology-enforces-ordering rule](./module-1-supervisor/07-topology-enforces-ordering.md), `course/lesson-07`
8. [Conditional fan-out + temperature-0 classification](./module-1-supervisor/08-fan-out-and-temperature-zero.md), `course/lesson-08`

### Module 2 · Specialist #1: Nutrition, *live*
9. [Per-agent retrieval namespacing](./module-2-nutrition/09-per-agent-retrieval-namespacing.md), `course/lesson-09`
10. [The embedding-consistency trap](./module-2-nutrition/10-embedding-consistency-trap.md), `course/lesson-10`
11. [Building the first specialist subgraph (Nutrition)](./module-2-nutrition/11-building-the-nutrition-subgraph.md), `course/lesson-11`
12. [The type-enforced "can't read other specialists' findings" trick](./module-2-nutrition/12-type-enforced-isolation.md), `course/lesson-12`

### Module 3 · Specialists #2 + #3: Workout + Recovery, *live*
13. [Adding Workout: the pattern repeats](./module-3-workout-recovery/13-adding-workout.md), `course/lesson-13`
14. [Adding Recovery, and why each specialist gets its own state schema](./module-3-workout-recovery/14-adding-recovery-and-isolation.md), `course/lesson-14`
15. [State passing and fan-in](./module-3-workout-recovery/15-state-passing-and-fan-in.md), `course/lesson-15`

### Module 4 · LangSmith evaluation, *live*
16. [Why multi-agent systems fail quietly, and what to evaluate](./module-4-evaluation/16-why-multi-agent-fails-quietly.md), `course/lesson-16`
17. [Deterministic evaluators: routing and citation](./module-4-evaluation/17-deterministic-evaluators.md), `course/lesson-17`
18. [The LLM-judge grounding evaluator](./module-4-evaluation/18-llm-judge-grounding.md), `course/lesson-18`
19. [Running evals in LangSmith](./module-4-evaluation/19-running-evals-in-langsmith.md), `course/lesson-19`
20. [The iteration loop and the growing dataset](./module-4-evaluation/20-iteration-loop-growing-dataset.md), `course/lesson-20`

### Module 5 · Deployment + multi-tenant, *live*
21. [LangGraph Platform and langgraph.json](./module-5-deployment/21-langgraph-platform-and-langgraph-json.md), `course/lesson-21`
22. [Deploying, and wiring env + database](./module-5-deployment/22-deploying-env-and-database.md), `course/lesson-22`
23. [Per-user state and auth on the live coach](./module-5-deployment/23-per-user-state-and-auth.md), `course/lesson-23`
24. [Cost and latency dashboards](./module-5-deployment/24-cost-and-latency-dashboards.md), `course/lesson-24`

### Module 6 · Extension launching pad, *live*
25. [How to add a new specialist (worked with Corrective)](./module-6-extension/25-how-to-add-a-new-specialist.md), `course/lesson-25`
26. [Five extensions, with starting file paths](./module-6-extension/26-extensions-with-file-paths.md), `course/lesson-26`
27. [Extending the eval suite as you extend the system](./module-6-extension/27-extending-the-eval-suite.md), `course/lesson-27`
28. [Capstone: ship your own specialist](./module-6-extension/28-capstone.md), `course/lesson-28`

---

> **Status.** All 28 lessons across 6 modules are authored on the
> `feat/langchain-academy-project-refactor` branch, decomposed and expanded from
> the repo's original five lessons (now superseded; see
> [`../lessons/`](../lessons/)). Each module's video script lives in its module dir
> as `module-N-video-script.md`; the intro/outro and production guide are in
> [`./video/`](./video/). Recording is gated on sign-off; the narration and
> screen-recording descriptions are written last, per module.
