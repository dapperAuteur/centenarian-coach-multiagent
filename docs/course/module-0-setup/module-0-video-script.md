# Video scripts · Module 0 (Setup + scope)

> Verbatim narration plus shot-by-shot screen-recording directions for lessons 1 to
> 4. Screencast lessons: record against the lesson's `course/lesson-NN` tag, clean
> `git status`, editor font >= 18pt, terminal >= 16pt, notifications off. Pace
> ~140 wpm. `[cite: ...]` marks where an on-screen citation appears; it must match
> that lesson's `## References`. No em-dashes in any on-screen text.

---

## Lesson m0-l1 · Course overview & the single-artifact promise · tag `course/lesson-01` · ~3.5 min

**NARRATION (verbatim)**

> Before we build anything, here is what we are building and how the course works.
>
> This is Fit T. Cent 3.0. The 3.0 is honest. I have shipped this coach twice
> before, and this version is the one we rebuild together.
>
> The architecture is a supervisor with specialists. One coordinator classifies your
> question and decides which specialists to consult. Each specialist owns its own
> knowledge base and its own tools, and the specialists never read each other's
> work. A synthesizer at the end weaves their findings into one answer with
> citations.
>
> The thing that makes this course different from every other multi-agent tutorial
> is per-agent retrieval. Most tutorials give every agent the same documents. Here,
> nutrition retrieves only from the nutrition corpus, workout only from workout. A
> corpus is just the set of documents a specialist can search. That isolation is the
> whole point, and it is enforced in code, not by a prompt. [cite: Lewis et al., 2020]
>
> And because this is a health domain, grounding is not optional. A confident wrong
> answer is a real problem, so every claim the coach makes is traceable to a source,
> and in Module 4 you will measure that with an evaluator. [cite: Ji et al., 2023]
>
> Here is the promise of this course: one artifact, built end to end. By the end of
> this first module, the coach runs on your machine. Modules 1 through 3 build the
> supervisor and the specialists. Module 4 adds evaluation. Module 5 deploys it.
> Module 6 shows you how to add your own specialist.
>
> A few mechanics. The lessons live in docs, course. Every lesson names the exact
> files it touches, so read it alongside the repo. Every lesson has a git tag, so you
> can check out any starting state. And every lesson ends with citations, because we
> hold the curriculum to the same grounding standard we hold the coach.
>
> Next, we get you set up. TypeScript first, since that is the language the coach is
> written in.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-01`; clean `git status`. Editor + browser open.
1. Editor: repo root tree, zoom on `docs/course/`.
2. Open `docs/course/README.md`; scroll the 6-module outline slowly under the
   "promise of this course" narration.
3. Open `src/graph.ts`; highlight the supervisor node and the four specialist nodes
   and the synthesize edge (the topology) on "supervisor with specialists."
4. On the per-agent line, open `src/agents/nutrition/retrieval.ts`; highlight the
   `"nutrition_kb"` namespace argument.
5. On the citations line, scroll to the `## References` block of any course lesson.
6. Terminal: `git tag -l 'course/lesson-*'` on the mechanics line.

---

## Lesson m0-l2 · Getting set up (TypeScript) · tag `course/lesson-02` · ~4 min

**NARRATION (verbatim)**

> Let's get the coach installed. You need Node 20 or newer, pnpm, a Postgres database
> with the pgvector extension, and a couple of API keys. Neon's free tier is what I
> use for Postgres. [cite: Neon, 2025; pgvector, 2025]
>
> Step one, clone and install.
>
> Step two, configure. Copy the example env file, open it, and fill in three things:
> an Anthropic or Gemini key for the chat models, a Gemini key for embeddings, and
> your database connection string. Embeddings default to Gemini, so set the Gemini
> key even if you run chat on Claude. Optionally set a LangSmith key for tracing. You
> will want it by the next lesson.
>
> Step three, apply the schema with pnpm db migrate. This runs the Drizzle migrations
> against your database. The first one creates the coach_kb table, one table with a
> namespace column and a 768-dimension embedding column, plus the match_coach_kb
> function that does the similarity search. That single namespaced table is the
> per-agent retrieval pattern you will dissect in Module 2. For now, just confirm the
> migration applies cleanly. [cite: Drizzle Team, 2025]
>
> One note specific to this repo: it tracks a current Next.js release, and the App
> Router conventions can differ from older tutorials. If you extend the app's routes,
> read the bundled guides under node modules, next, dist, docs rather than relying on
> memory. [cite: Vercel, 2025]
>
> You are set up when install and migrate both finish without errors. You have not
> run the coach yet. That needs a seeded corpus, which is the smoke test two lessons
> from now. If you prefer Python, the next lesson maps the concepts across.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-02`; clean terminal, large font.
1. Terminal: `git clone ...`, `cd centenarian-coach-multiagent`, `pnpm install`
   (speed-ramp the install to 3x with a "fast-forward" marker).
2. `cp .env.example .env.local`; open `.env.local` in the editor; highlight (do not
   reveal real values) the four keys: `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`,
   `STORAGE_DATABASE_URL`, `LANGSMITH_API_KEY`. Show `.env.example` comments, never
   real secrets.
3. Terminal: `pnpm db:migrate`; show the migration success output.
4. Editor: open `src/db/migrations/0000_*.sql`; zoom on the `coach_kb` table and the
   `match_coach_kb(...)` function signature.
5. Brief: `drizzle.config.ts` and `src/db/schema.ts` `coachKb` definition.

---

## Lesson m0-l3 · Getting set up (Python) + language translation · tag `course/lesson-03` · ~3 min

**NARRATION (verbatim)**

> LangChain Academy courses are usually taught in Python. This course's artifact is
> TypeScript, one runnable coach, so every lesson can point at the real files you
> deploy. This short lesson is the bridge for Python-first learners. There is no
> second Python codebase, but the concepts map cleanly, and LangGraph ships in both
> languages with the same mental model. [cite: LangChain, 2025]
>
> If you want a Python environment alongside, create a venv and pip install
> langgraph, langchain-anthropic, langsmith, and pydantic. Treat it as a Rosetta
> stone, not a fork.
>
> Here is the translation table. A StateGraph is a StateGraph in both. State is an
> Annotation.Root in TypeScript, a TypedDict with Annotated fields in Python.
> Structured output is with-structured-output in both, backed by Zod in TypeScript
> and Pydantic in Python. The chat-model classes match. Add-node and
> add-conditional-edges match. Evaluation is evaluate in the JavaScript langsmith
> package, evaluate or aevaluate in Python. [cite: Pydantic, 2025]
>
> The shapes match because LangGraph models the same thing in both languages: a state
> graph with typed channels, reducers that merge concurrent writes, and conditional
> edges for routing. The two places they diverge in this course are the schema
> library and the evaluation SDK surface.
>
> Why the artifact stays TypeScript: a single runnable artifact lets every lesson
> cite a real file and a real trace, and lets the branch tag one commit per lesson. A
> parallel Python copy would double the surface that can drift. So Python here is a
> reference, and the rest of the course works the TypeScript repo directly. If you
> are TypeScript-only, skip straight to the smoke test.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-03`.
1. Full-screen slide: the translation table (TypeScript column vs Python column),
   built row by row as narrated. Open `docs/course/module-0-setup/03-getting-set-up-python.md`
   and show the same table in the lesson.
2. Terminal: `python -m venv .venv && source .venv/bin/activate`, then the
   `pip install ...` line (speed-ramp).
3. Side-by-side editor: `src/state.ts` `Annotation.Root` next to a short Python
   `TypedDict`/`Annotated` snippet on the slide, on the "state" row.

---

## Lesson m0-l4 · First-run smoke test · tag `course/lesson-04` · ~5 min

**NARRATION (verbatim)**

> The promise of Module 0 is that the coach runs before you learn how it works. Let's
> make that happen: seed a corpus, ask one question, read the answer and its trace.
>
> Step one, seed a corpus. Each specialist retrieves from its own namespace in the
> coach_kb table, so the table needs documents first. Drop a corpus into kb-fixtures
> following the shape in the kb-fixtures readme, then run pnpm kb seed. This embeds
> every document with the same model the coach uses at query time and writes a
> 768-dimension vector per row. That same-model rule is the embedding-consistency
> trap you will meet in Module 2. Confirm it worked with pnpm kb status, which prints
> the row counts per namespace. [cite: Reimers & Gurevych, 2019]
>
> Step two, ask a question. Start the dev server and open the coach. Ask: how much
> protein should a 70-year-old eat to preserve muscle?
>
> Watch the events arrive in order. First a session id. Then the routing decision,
> this question goes to nutrition, with a rationale. Then the nutrition finding, with
> citations to the snippets it retrieved. Then the synthesizer's final answer, with
> the combined citations. That ordering is not luck. It is enforced by the graph's
> structure, which is Module 1. The citations are the grounding discipline made
> concrete: the answer rests on retrieved documents, not the model's memory.
> [cite: Lewis et al., 2020]
>
> Step three, read the trace. If you set a LangSmith key, every query writes a trace.
> Open the run and you see the tree: the supervisor, the nutrition specialist as a
> nested subgraph, retrieve to assess to compose, and the synthesizer at the end.
> Tracing is how you debug a system that fails quietly. A wrong route still produces
> a fluent answer, and the trace is where you see why. [cite: LangChain, 2025]
>
> You now have a running, observable coach. A seeded corpus, a routed and cited
> answer, and a trace. That is the whole system in miniature. Module 1 starts where
> this lesson glossed over: how does the supervisor decide where to route, and why is
> the ordering guaranteed?

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-04`; database reachable; LangSmith key set.
1. Terminal: `pnpm kb:seed` (speed-ramp the embedding loop; land on the
   "seeded N docs" summary). Then `pnpm kb:status`; show the per-namespace counts
   (nutrition_kb, workout_kb, recovery_kb, corrective_kb all non-empty).
2. Terminal: `pnpm dev`; open `http://localhost:3000/coach`.
3. Type the protein question; submit. Screen-capture the streamed events in order;
   add lower-third labels as each lands: `session` -> `routing` (highlight
   `agents: ["nutrition"]` + rationale) -> `finding` (highlight the citations) ->
   `answer` (highlight the combined citations under the answer).
4. Switch to the LangSmith tab (browser zoom 125-150%). Open the matching run;
   expand the tree: `supervisor` -> `nutrition` subgraph (`retrieve` -> `assess` ->
   `compose`) -> `synthesize`. Point at the retrieved snippets on the `retrieve`
   node.
5. Close on the answer + trace side by side.

---

## Module 0 runtime check

intro 1.5 + l1 3.5 + l2 4 + l3 3 + l4 5 = ~17 min on camera/screen. Trim narration,
not demos, if a take runs long.
