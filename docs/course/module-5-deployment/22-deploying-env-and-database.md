# Module 5 · Lesson 22 · Deploying, and wiring env + database

> **Tag:** `course/lesson-22` · **Module 5: Deployment + multi-tenant** · ~6 min

There are two places the coach runs in production, and both are free. This lesson
covers what each needs, and the one wiring mistake that silently breaks retrieval.

## Two targets

- **The app, on Vercel.** The chat UI, history, and admin dashboard deploy as a
  Next.js App Router app, with the graph running inside the API routes. Vercel
  builds remotely, so this needs no Docker on your machine, and the Hobby tier is
  free (Vercel, 2025). This is the live public instance for the course.
- **The graph, on LangGraph Platform.** Locally via `pnpm deploy:dev` (Lesson 21,
  free, no Docker). A fully managed Cloud deployment is available but requires the
  paid Plus plan, so the course treats it as optional polish, not a requirement
  (LangChain, 2025). The free path (Vercel live + local platform run) is the
  default and is enough for the deployment lessons.

## The environment a deployed graph needs

Wherever the graph runs, it needs the same things the app needs:

- `DATABASE_URL` (or `STORAGE_DATABASE_URL`): a Neon Postgres with the `pgvector`
  extension and the `match_coach_kb` function, **with `coach_kb` seeded in that
  database** (Neon, 2025).
- An embeddings key (`GEMINI_API_KEY`) and at least one LLM key
  (`ANTHROPIC_API_KEY` or `GEMINI_API_KEY`).
- Optional: `LANGSMITH_API_KEY` for tracing, and `COACH_LLM_PROVIDER` /
  `COACH_FALLBACK_PROVIDERS` to pick the model and fallback chain.

## The one mistake that breaks everything quietly

The most common deployment failure is not a crash. It is pointing the deployment at
a database where `coach_kb` is empty (or seeded with a different embedding model,
Lesson 10). Retrieval returns nothing, the specialists have no sources, grounding
collapses, and the app still answers, just badly. The rule:

> Run `pnpm kb:seed` against the exact `DATABASE_URL` the deployment uses, and
> confirm with `pnpm kb:status`.

If the deployment shares the app's database, you are done. If it uses its own, seed
that one too. This is the deployment version of the embedding-consistency trap: the
data has to be where the graph looks for it, in the space the graph embeds in.

## Operator step, and what it gates

Standing up a managed Cloud deployment is an operator action (account, secrets),
tracked in `plans/user-tasks/12`. It gates only the *managed* URL and the strongest
form of rubric P2. The free path (Vercel + `pnpm deploy:dev`) needs no operator
step beyond confirming the seeded database, which is already done for this build.

### Build on the coach

Confirm the deployment's database is seeded: `pnpm kb:status` against the
production `DATABASE_URL` should show non-empty counts for all four namespaces.
Then ask the live coach a question and verify the answer carries citations. An
answer with no citations is the empty-database symptom; a seeded database is the
fix.

## References

LangChain. (2025). *LangSmith Deployment documentation*. https://docs.langchain.com/langgraph-platform/

Neon. (2025). *Neon documentation: Connection strings and pgvector*. https://neon.tech/docs

Vercel. (2025). *Vercel documentation: Deploying Next.js*. https://vercel.com/docs

---

Previous: [Lesson 21 · LangGraph Platform and langgraph.json](./21-langgraph-platform-and-langgraph-json.md) · Next: **[Lesson 23 · Per-user state and auth](./23-per-user-state-and-auth.md)** · [Course index](../README.md)
