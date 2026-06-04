# Video scripts · Module 5 (Deployment + multi-tenant)

> Verbatim narration + shot-by-shot screen-recording directions for lessons 21 to
> 24. Audience note: first-time viewers; gloss terms on first use. Record against the
> lesson's `course/lesson-NN` tag. Pace ~140 wpm. `[cite: ...]` = on-screen citation
> matching that lesson's `## References`. Cloud steps are gated on the operator task;
> the free, no-Docker path is the default to record. No em-dashes on screen.

---

## Lesson m5-l21 · LangGraph Platform and langgraph.json · tag `course/lesson-21` · ~6 min

**NARRATION (verbatim)**

> Until now the coach graph has run inside the app's API routes. This module also
> makes it deployable as a standalone graph on LangGraph Platform, which is LangChain's
> managed runtime for graphs. The good news: you can run that surface locally, with no
> Docker and no spend.
>
> Two files declare the deployment. langgraph.json names one graph, coach, and points
> at an export. That export is a deliberately thin file, src/deployment/graph.ts,
> which just re-exports the compiled coach graph. [cite: LangChain, 2025a]
>
> Why a thin re-export instead of pointing straight at the real graph file? It isolates
> the single import the Platform build has to resolve. The whole graph imports through
> the at-slash path alias, and alias resolution inside the Platform build is not
> guaranteed. If the build ever fails to find at-slash-graph, this one line is where you
> switch to a relative import. One known risk, localized to one line.
>
> Run it locally with pnpm deploy colon dev. That starts the Agent Server in memory, in
> your environment, with no Docker, no Postgres, no Redis. It boots in seconds and
> exercises the exact langgraph.json resolution, so it surfaces that path-alias risk
> before any cloud step. This matters here specifically: the only CLI command that
> needs Docker is langgraph up, which this course does not use. [cite: LangChain, 2025b]
>
> The deployed graph is a second front door onto the same compiled graph. The app keeps
> importing it exactly as before; nothing about the running app changes. Next, what the
> graph needs wherever it runs.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-21`.
1. Open `langgraph.json`; highlight `graphs: { coach: "./src/deployment/graph.ts:coachGraph" }`.
2. Open `src/deployment/graph.ts`; show it is one re-export line; read the comment
   about the `@/` alias fallback.
3. Terminal: `pnpm deploy:dev`; show the local Agent Server boot (no Docker); open it
   and send one question; confirm the same routed, cited answer.

---

## Lesson m5-l22 · Deploying, and wiring env + database · tag `course/lesson-22` · ~6 min

**NARRATION (verbatim)**

> There are two places the coach runs in production, and both are free. Target one, the
> app on Vercel: the chat UI, history, and admin deploy as a Next.js app with the graph
> running inside the API routes. Vercel builds remotely, so no Docker on your machine,
> and the Hobby tier is free. This is the live public instance for the course.
> [cite: Vercel, 2025] Target two, the graph on LangGraph Platform: locally with pnpm
> deploy colon dev, which you just saw. A fully managed cloud deployment exists but
> needs the paid plan, so the course treats it as optional polish, not a requirement.
> [cite: LangChain, 2025]
>
> Wherever the graph runs, it needs the same things: a database URL pointing at a
> Postgres with pgvector and the coach_kb table seeded in that database, an embeddings
> key, and an LLM key. [cite: Neon, 2025]
>
> And here is the one mistake that breaks everything quietly. It is not a crash. It is
> pointing the deployment at a database where coach_kb is empty, or seeded with a
> different embedding model. Retrieval returns nothing, the specialists have no sources,
> grounding collapses, and the app still answers, just badly. The rule: run pnpm kb seed
> against the exact database URL the deployment uses, and confirm with pnpm kb status.
> This is the deployment version of the embedding-consistency trap: the data has to be
> where the graph looks for it, in the space the graph embeds in.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-22`.
1. Show the two targets on a slide: Vercel (app, live) and LangGraph Platform (graph,
   local via `pnpm deploy:dev`; managed cloud optional).
2. Show the env the deployed graph needs (a slide; never reveal real secret values):
   `DATABASE_URL`, an embeddings key, an LLM key.
3. Terminal: `pnpm kb:status` against the production `DATABASE_URL`; show non-empty
   counts. Then ask the live coach a question; confirm the answer carries citations
   (the empty-DB symptom is an answer with no citations).

---

## Lesson m5-l23 · Per-user state and auth on the live coach · tag `course/lesson-23` · ~5 min

**NARRATION (verbatim)**

> A deployed coach faces real users, which raises two questions the local demo could
> ignore: who can use it, and how do you keep one user's data from another's. Let me be
> honest about what ships today and what multi-tenancy would add, because the gap is the
> lesson.
>
> What ships today is single-tenant and admin-gated. The state has no user id, by
> design; the demo is gated to one operator. Each query gets a session id and is
> persisted, but there is no per-user partition. Access is a magic-link sign-in where
> only the admin email is allowed in; everyone else lands on a waitlist. That is the
> right amount of auth for a gated portfolio demo. [cite: Auth.js, 2025]
>
> What multi-tenancy adds, you thread through the same structures you already have. One,
> a user id on the state, stamped on each session row, so history and analytics
> partition by user. Two, per-user data scoping: reads filter by user id, so a user can
> reach only their own data. That is the principle of least privilege again, now at the
> tenant boundary. [cite: Saltzer & Schroeder, 1975] If users bring their own corpus,
> the namespace pattern from Module 2 extends to per-user namespaces. Three, real
> authorization: the single-admin check becomes per-user sessions with the same auth
> machinery already wired.
>
> The point of naming the gap rather than hiding it: the architecture is ready for
> tenancy. The work is additive, not a rewrite, which makes per-user state a natural
> Module 6 extension.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-23`.
1. Open `src/state.ts`; point at the comment that the demo is single-tenant (no userId);
   show the `sessionId`.
2. Open `src/db/schema.ts`; show `coach_sessions` and the Auth.js tables (`user`,
   `session`) that already exist.
3. **BONUS FOOTAGE (optional).** Sketch the multi-tenant diff on screen: a `userId`
   field added to the state, a `userId` column on `coach_sessions`, and a
   `WHERE userId = ...` on the reads. Talk-only; do not implement.

---

## Lesson m5-l24 · Cost and latency dashboards · tag `course/lesson-24` · ~5 min

**NARRATION (verbatim)**

> A deployed coach makes six or more model calls per question: the supervisor, one per
> specialist, and the synthesizer. In production you need to see what that costs and how
> long it takes. That is the payoff of the tracing you wired in Module zero: the same
> traces feed LangSmith's dashboards. You did not add anything new for monitoring; the
> dashboards read the runs you are already producing. [cite: LangChain, 2025]
>
> Three things to watch. Latency per node: the trace tree shows where time goes. Because
> the specialists fan out in parallel, wall-clock is the slowest specialist plus the
> supervisor and synthesizer, not the sum. If one specialist dominates, that is where to
> optimize. Tokens and cost per run: the composer and synthesizer carry the biggest
> prompts, so watching cost per question is how you decide whether a cheaper model on a
> role is worth it. And cost by provider: the coach's provider is runtime configuration,
> from the admin dashboard, and the eval runner already tags experiments with the
> provider, so you can compare cost and quality across providers on the same dataset
> instead of by anecdote.
>
> The reason this is a deployment lesson and not a footnote: a multi-agent system's cost
> and latency are emergent, they come from the fan-out, the tool calls, and the model
> choice per role, so you cannot reason about them from the code alone. You measure the
> running system. Because tracing was wired in from the first run, the deployed coach is
> observable by default.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-24`; LangSmith project open.
1. Open a recent cross-domain run; read total latency + token count; expand the tree and
   show which node spent the most.
2. **BONUS FOOTAGE (optional).** Provider A/B: change the provider in `/admin`, ask the
   same question, and compare the two runs' cost + latency in the dashboard.

---

## Module 5 runtime check

l21 6 + l22 6 + l23 5 + l24 5 = ~22 min.
