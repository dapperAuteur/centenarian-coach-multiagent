# Migration notes — `feat/langchain-academy-project-refactor`

**Goal:** refactor this repo into a LangChain Academy **Project** course,
*Domain-Specialist Multi-Agent with Per-Agent RAG* — 6 modules / 28 lessons /
~2.5 hr video — lifting the existing 4/5 baseline to "Exceeding" (every rubric
criterion ≥ 4, ≥ 3 at 5). Source-of-truth: `plans/PRD-langchain-academy-project.md`.

## Build status — Phase A complete; checkpoint pause

The build runs in two phases (per the approved plan + the kickoff's
"scaffold + Module 0, then checkpoint" decision):

- **Phase A (this push):** branch scaffold + Module 0, then pause for BAM to
  approve lesson tone + APA-7 citation format **before** mass-producing Modules
  1–6. ✅ Done.
- **Phase B (after approval):** Modules 1–6 lessons; eval iteration-arc lesson;
  bam-landing-page PR; final self-scoring; legacy `docs/lessons/` folds into
  `docs/course/`. Module 5 *cloud* steps gated on operator task 12; video gated
  on task 13 + BAM's record go-ahead.

## Files changed (paths only)

**Added — artifact code (committed):**
- `evals/grounding.ts` · `evals/run-langsmith.ts`
- `langgraph.json` · `src/deployment/graph.ts`
- `tests/topology.test.ts`

**Modified — artifact code (committed):**
- `evals/rubric.ts` · `evals/dataset.json` · `tests/coach.eval.test.ts`
- `package.json` · `pnpm-lock.yaml` · `README.md`

**Added — course + video docs (committed):**
- `docs/course/README.md`
- `docs/course/module-0-setup/01-course-overview.md`
- `docs/course/module-0-setup/02-getting-set-up-typescript.md`
- `docs/course/module-0-setup/03-getting-set-up-python.md`
- `docs/course/module-0-setup/04-first-run-smoke-test.md`
- `docs/video/README.md` · `docs/video/production-guide.md` · `docs/video/script.md`

**Added — operator tasks (local; `plans/` is gitignored, NOT committed):**
- `plans/user-tasks/12-provision-langsmith-deployment.md`
- `plans/user-tasks/13-recording-stack-and-video-host.md`
- `plans/user-tasks/14-cover-letter-sign-off.md`
- `plans/user-tasks/00-describe-how-to-use-user-tasks.md` (index → 5-col format)

**Per-lesson tags:** `course/lesson-00` (pristine start) … `course/lesson-04`
(Module 0). `git checkout course/lesson-04` lands at the first-run smoke test.

## Rubric self-scoring (§3 of the PRD)

Honest at end of Phase A, with the Phase-B / operator-task target.

| # | Criterion | Phase A (now) | Target | Evidence / what's left |
|---|---|---|---|---|
| P1 | One cohesive artifact | **4** | 5 | Module 0 ends in a first-run smoke test (`lesson-04`); single-artifact discipline holds. 5 once the Module 6 extensibility close lands. |
| P2 | Multiple ecosystem tools | **4** | 5 | LangGraph + LangSmith (trace + `evaluate()` runner) + pgvector + Drizzle + Zod + LangGraph Platform **scaffold**. 5 once the live Deployment is provisioned (task 12). |
| P3 | Project-scale runtime | **3** | 5 | 6-module/28-lesson structure fixed + Module 0 authored; runtime budget ~2h26m. 5 once Modules 1–6 prose + video land. |
| P4 | Deep code refs + tagged commits | **5** | 5 | Every Module 0 lesson names real file paths; `course/lesson-NN` tags exist and check out. Pattern sustained as lessons land. |
| P5 | Eval/observability built in | **4** | 5 | `rubric.ts` (routing+citation) + `grounding.ts` (LLM-judge) + `run-langsmith.ts` (`evaluate()`) + growing-dataset convention (`addedIn`/`note`, 3 regression examples). 5 once the Module 4 iteration-arc lesson is written. |
| P6 | Extensibility close | **2** | 5 | Not yet materialized — Module 6 (the "add a new specialist" lesson, worked with the wired `corrective` agent) is Phase B. Code + plan already support it. |

No stop condition tripped: every sub-3 score (P3, P6) reaches target in Phase B
via planned, scoped work — this is expected mid-build state, not a blocker.

## Per-provider eval reruns

**None this session.** Code changes were verified by `pnpm typecheck` + `pnpm test`
(no live LLM calls). Live eval reruns (`pnpm eval`, `RUN_GROUNDING=1 pnpm eval`,
`pnpm eval:langsmith`) need keys/DB and are part of the Module 4 authoring pass.

## Blocked on operator tasks

- **Task 12 — LangSmith Deployment.** Blocks Module 5 cloud lessons + **P2=5**.
  Deployment URL pending; goes into README, here, and the landing PR.
- **Task 13 — Recording stack + Cloudinary.** Blocks the video → **P3=5**.
  Recording is also separately gated on BAM's go-ahead (no speculative recording).
- **Task 14 — Cover-letter sign-off.** Blocks application submission, not the build.

## Pending deliverables (Phase B)

- **bam-landing-page PR** at `/learn/project-multi-agent-rag` — opened once course
  content is ready; URL recorded here. **Not yet opened.** (Do NOT edit
  bam-landing-page from this branch.)
- **LangSmith Deployment URL** — recorded here once task 12 completes. **Pending.**

## Verification (Phase A)

- `pnpm typecheck` — **green**.
- `pnpm test` — **green**: 8 files / 39 passed, 1 file (key-gated `coach.eval`)
  skipped. Includes the new `tests/topology.test.ts`.
- `pnpm lint` — changed files are **error-free** (one warning in `topology.test.ts`
  mirroring the accepted `coach.wiring.test.ts` pattern). The 10 errors are
  **pre-existing** in `src/app/{coach,page,signin}` pages and unchanged from the
  `course/lesson-00` baseline (`git diff course/lesson-00 -- src/app/...` is empty).
  Out of scope here; fix on a separate `chore/eslint-cleanup` branch.
- Tags `course/lesson-00..04` created; `git checkout` verified to switch states.

## Tagging caveat (Phase B finalization)

All artifact-scaffold code (evals, `langgraph.json`, topology test) landed up front,
so tags `course/lesson-01..04` (Module 0) include code that belongs to later
modules. This is cosmetic — Module 0's lessons run fine against it — and the
per-lesson tag purity (each module's code at its own lessons) is the documented
post-authoring finalization pass once Modules 1–6 land.

## Stop conditions

None tripped. Branch committed + pushed; **not merged** (BAM merges). Single branch
per the kickoff — no bundle needed. Paused at the planned Module 0 checkpoint for
tone + citation-format approval before Modules 1–6.
