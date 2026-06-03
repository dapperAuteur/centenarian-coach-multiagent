# Migration notes, `feat/langchain-academy-project-refactor`

**Goal:** refactor this repo into a LangChain Academy **Project** course,
*Domain-Specialist Multi-Agent with Per-Agent RAG* (the coach is **Fit T. Cent
3.0**), 6 modules / 28 lessons / ~2.5 hr video, lifting the 4/5 baseline to
"Exceeding" (every rubric criterion >= 4, at least three at 5). Source of truth:
`plans/PRD-langchain-academy-project.md`.

## Build status: curriculum complete

All **28 lessons across 6 modules** are authored, em-dash-free, APA-7 cited, with
real file-path references and coach-extending exercises, each on its own commit and
tagged `course/lesson-00` through `course/lesson-28`. Branch pushed, not merged
(BAM merges; single branch, no bundle, see operator task 15).

**Remaining (not blocking the curriculum):**
- **bam-landing-page PR** for `/learn/project-multi-agent-rag` (separate repo; open
  next now that content is ready, per PRD section 7). Not yet opened.
- **Video recording** (operator task 13; gated on sign-off). Verbatim narration and
  screen-recording descriptions are written last, per module, against the final
  lessons.
- **Managed LangGraph Platform URL** (operator task 12; optional polish, the free
  Vercel + `pnpm deploy:dev` path is the default and is done).

## Files changed (paths only)

**Added, course:** `docs/course/README.md` and `docs/course/module-{0-setup,
1-supervisor,2-nutrition,3-workout-recovery,4-evaluation,5-deployment,
6-extension}/*.md` (28 lessons).

**Added, video:** `docs/video/{README,production-guide,script}.md`.

**Added, artifact code:** `evals/grounding.ts`, `evals/run-langsmith.ts`,
`langgraph.json`, `src/deployment/graph.ts`, `tests/topology.test.ts`.

**Modified, artifact code:** `evals/rubric.ts`, `evals/dataset.json`,
`tests/coach.eval.test.ts`, `package.json`, `pnpm-lock.yaml`, `README.md`.

**Modified, legacy:** `docs/lessons/*.md` (deprecation banner pointing to
`docs/course/`; em-dashes removed).

**Added, operator tasks (local; `plans/` gitignored, not committed):**
`plans/user-tasks/12-provision-langsmith-deployment.md` (DONE, free path),
`13-recording-stack-and-video-host.md`, `14-cover-letter-sign-off.md`,
`15-merge-course-branch-to-main.md`, and the `00-describe` index.

## Rubric self-scoring (section 3 of the PRD)

| # | Criterion | Score | Evidence |
|---|---|---|---|
| P1 | One cohesive artifact | **5** | Module 0 ends in a runnable first-run smoke test; single-artifact discipline throughout; Module 6 is the extensibility close. |
| P2 | Multiple ecosystem tools | **4** | LangGraph + LangSmith (tracing + `evaluate()`) + LangGraph Platform (scaffold + local `pnpm deploy:dev`) + pgvector + Drizzle + Zod; the artifact runs end to end live on Vercel. Reaches 5 with the managed Cloud deployment (optional, task 12). |
| P3 | Project-scale runtime | **4** | 28 lessons / 6 modules / capstone; ~2h26m runtime budget. Reaches 5 once the video is recorded (gated, task 13). |
| P4 | Deep code refs + tagged commits | **5** | Every lesson names real file paths; `course/lesson-00..28` tags exist and `git checkout` works. |
| P5 | Eval/observability built in | **5** | routing + citation evaluators (`rubric.ts`), LLM-judge grounding (`grounding.ts`), LangSmith `evaluate()` runner (`run-langsmith.ts`), and a dataset that grows with provenance (`addedIn`/`note`); Module 4 teaches the find-bug to add-example to re-run loop. |
| P6 | Extensibility close | **5** | Module 6 is the "how to add a new specialist" worked example (Corrective), five named extensions with file paths + difficulty, extend-the-evals discipline, and a capstone. |

Every criterion is >= 4 with four at 5 (P1, P4, P5, P6), which clears the
"Exceeding" bar (every >= 4, at least three at 5). P2 and P3 reach 5 with the two
operator-gated items (managed deploy, recorded video); neither is a deal-breaker
and both are scoped.

## Deal-breakers (PRD section 3.1)

All delivered: explicit eval module with a growing dataset (Module 4); explicit
citation-grounding lesson (Lesson 18, plus grounding woven through Modules 1 to 3);
single shipped artifact (the support-desk transfer exercise is dropped; exercises
extend the coach); Lesson 0 setup (Module 0, ending in the smoke test).

## Per-provider eval reruns

None this session. Code verified by `pnpm typecheck` + `pnpm test` (no live LLM
calls). Live reruns (`pnpm eval`, `RUN_GROUNDING=1 pnpm eval`, `pnpm eval:langsmith`)
need keys + a seeded DB; they are exercised in the Module 4 authoring and by the
test reader.

## Style

No em-dashes in any authored content (course, video, README, docs, code comments)
or in the legacy `docs/lessons/*.md`. Commas in prose, the `·` separator in lesson
titles, hyphens in table cells. En-dashes remain only inside APA-7 reference page
ranges, where the citation format requires them.

## Verification

- `pnpm typecheck`: green.
- `pnpm test`: green (includes `tests/topology.test.ts`; the key-gated eval is
  skipped without keys).
- Em-dash check across course/docs/code: 0.
- `git checkout course/lesson-NN`: switches to any lesson's state (29 tags).
- Lint: changed files error-free; the 10 pre-existing errors in `src/app/*` pages
  are unchanged from the `course/lesson-00` baseline and out of scope.

## Tagging caveat

Artifact scaffold (evals, `langgraph.json`, topology test) and the em-dash scrub
landed as their own commits, so a given `course/lesson-NN` tag may include code or
style fixes from a later commit. Lessons run fine against it. Strict per-lesson tag
purity (each module's code at its own lessons) is a documented finalization pass if
desired; it does not affect the checkout-any-lesson UX.

## Stop conditions

None tripped. Branch committed and pushed, not merged. Curriculum complete; video
and managed deploy are gated/optional as noted.
