# v2 follow-up walkthrough — script & shot list

A short (~4-5 minute) follow-up to the main [walkthrough](./walkthrough.md),
covering what v2 adds: the Recovery specialist, three-way fan-out, and the
eval harness. Assumes the viewer has seen the v1 walkthrough.

## Before you record

- `pnpm dev` running, KB seeded including `recovery_kb` (`pnpm kb:seed`).
- Tabs ready: `/coach`, the editor with `src/agents/recovery/subgraph.ts`,
  `src/graph.ts`, `evals/dataset.json`, and `evals/rubric.ts` open.
- A cross-domain demo question that pulls all three specialists, for example:
  *"I slept six hours, want to build muscle, and have a heavy session planned.
  What should I eat, how should I train, and should I rest?"*

---

## 0:00-0:30 - what v2 adds

**Say:** "v1 shipped a supervisor with two specialists, Nutrition and Workout.
v2 adds the third, Recovery, and an eval harness that scores routing and
citations across a dataset. Same architecture, two more pieces."

**Show:** the v1 architecture diagram in `docs/architecture.md`.

## 0:30-2:00 - the Recovery specialist

**Say:** "Recovery is a faithful mirror of the other two specialists. Its own
subgraph, its own `recovery_kb` retrieval namespace, its own tools. The tools
are `sleepDataMock` and `hrvTrendMock`, which return demo fixture data in
place of a real wearable integration."

**Show:** `src/agents/recovery/subgraph.ts` (retrieve, assess, tools, compose,
same shape as the others), then `src/agents/recovery/tools/`. Point out that
the subgraph state still has no `findings` channel, so Recovery cannot read
the other specialists either.

**Show:** `src/graph.ts` - the `recovery` node is added, `routeToSpecialists`
now fans out to all three, and there is no longer a "Recovery is v2" carve-out.

## 2:00-3:15 - three-way fan-out, live

**Say:** "Because the supervisor can now route to all three, a genuinely
cross-domain question fans out three ways."

**Show:** the `/coach` page. Submit the demo question. Point at the routing
status row showing all three specialists consulted, then the synthesized
answer that weaves nutrition, workout, and recovery guidance together, with
citations grouped by all three agents.

## 3:15-4:30 - the eval harness

**Say:** "Manual review does not scale. v2 adds an eval dataset and a runner."

**Show:** `evals/dataset.json` - 20 labelled questions, each with the
specialists it should route to. Then `evals/rubric.ts` - the routing and
citation evaluators, pure functions with their own unit tests.

**Say:** "`pnpm eval` runs the graph over all 20 questions, scores each, and
fails if routing accuracy or citation coverage drops below threshold. It is a
regression gate, not a vanity metric."

**Show:** the `pnpm eval` command (or a recorded run's summary table if a live
run is slow).

## 4:30-end - wrap

**Say:** "That completes the curriculum's multi-agent module: a supervisor,
three specialists with isolated retrieval and tools, a synthesizer, and evals
to keep it honest. The five lessons in `docs/lessons/` walk through every
design decision."

**Show:** `docs/lessons/README.md`, then the GitHub repo for the sign-off.
