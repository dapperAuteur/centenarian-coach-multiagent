# Module 0 · Lesson 2 · Getting set up (TypeScript)

> **Tag:** `course/lesson-02` · **Module 0: Setup + scope** · ~4 min

The coach is a TypeScript app: a Next.js App Router project (Vercel, 2025) whose
API routes run a LangGraph.js graph (LangChain, 2025). This lesson gets it
installed and its database ready. Lesson 4 runs it.

## What you need

- **Node 20+** and **pnpm** (the repo pins Node in `.nvmrc`; scripts assume pnpm).
- **A Postgres database with the `pgvector` extension.** Neon's free tier works and
  is what the course assumes (Neon, 2025); pgvector adds the vector type and
  similarity operators retrieval depends on (pgvector, 2025).
- **An LLM provider.** Either an API key, `ANTHROPIC_API_KEY` (Claude) and/or
  `GEMINI_API_KEY` (embeddings default to Gemini, so set `GEMINI_API_KEY` even if
  you run chat on Claude), **or run the whole coach free and local with Ollama, no
  key required** (see "Running it free with Ollama" below).
- **Optional:** `LANGSMITH_API_KEY` for tracing. Tracing is fail-soft, the app
  runs without it, but you will want it by Lesson 4 to see the trace.

## Steps

```bash
# 1. Clone and install
git clone https://github.com/dapperAuteur/centenarian-coach-multiagent.git
cd centenarian-coach-multiagent
pnpm install

# 2. Configure
cp .env.example .env.local
#   Fill ANTHROPIC_API_KEY and/or GEMINI_API_KEY, STORAGE_DATABASE_URL
#   (your Neon connection string), and optionally LANGSMITH_API_KEY.

# 3. Apply the schema to your database
pnpm db:migrate
```

`.env.example` is the annotated source of truth for every variable; read it once.
The connection string is read as `STORAGE_DATABASE_URL` (or `DATABASE_URL`).

## What `pnpm db:migrate` actually does

It runs the Drizzle migrations in [`src/db/migrations/`](../../../src/db/migrations/)
against your database (Drizzle Team, 2025). The first migration creates the
`coach_kb` table, one table, with a `namespace` column and an `embedding
vector(768)` column, and the `match_coach_kb(query_embedding, namespace_filter,
match_count)` SQL function that does the cosine-similarity search each specialist
calls. That single namespaced table is the per-agent-RAG pattern you will dissect
in Module 2; for now, just confirm the migration applies cleanly.

The Drizzle config lives in [`drizzle.config.ts`](../../../drizzle.config.ts), and
the schema it generates from is [`src/db/schema.ts`](../../../src/db/schema.ts).

## A note on the framework version

This repo tracks a current Next.js release, and its conventions can differ from
older tutorials. If you are extending the app's routes or pages, read the bundled
guides under `node_modules/next/dist/docs/` rather than relying on memory, the
App Router's data-fetching and route-handler APIs move between majors (Vercel,
2025).

## Running it free with Ollama (optional, no API keys)

Do not want to sign up for a paid API to try the course? You can run the whole
coach **free and local** with [Ollama](https://ollama.com), which serves open
models on your own machine. There is no API key: the coach just points at your
local Ollama server.

```bash
# 1. Install Ollama (https://ollama.com), then pull two models:
ollama pull nomic-embed-text   # embeddings (768-dim, matches the coach_kb column)
ollama pull llama3.1           # a local chat model; match the name to the coach's
                               #   Ollama default in src/lib/llm-config.ts, or pick
                               #   the model later in the /admin dashboard

# 2. In .env.local, point chat AND embeddings at Ollama:
COACH_LLM_PROVIDER=ollama
COACH_EMBED_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434   # the default; override only if needed
```

That is the whole setup, no `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` needed. You can
also mix providers (for example Claude for chat, Ollama for embeddings). One rule,
covered in Lesson 10: seed and query must use the **same** embedding backend, so if
you switch `COACH_EMBED_PROVIDER` after seeding, re-seed
(`pnpm kb:clear --all && pnpm kb:seed --fresh`).

## Checkpoint

You are set up when `pnpm install` and `pnpm db:migrate` both finish without error.
You have **not** run the coach yet, that needs a seeded corpus, which is Lesson 4.
If you prefer Python, Lesson 3 maps the concepts across before you continue.

## References

Drizzle Team. (2025). *Drizzle ORM documentation*. https://orm.drizzle.team/docs

LangChain. (2025). *LangGraph.js documentation*. https://langchain-ai.github.io/langgraphjs/

Neon. (2025). *Neon documentation: Postgres with pgvector*. https://neon.tech/docs

pgvector. (2025). *pgvector: Open-source vector similarity search for Postgres* [Computer software]. GitHub. https://github.com/pgvector/pgvector

Vercel. (2025). *Next.js documentation: App Router*. https://nextjs.org/docs/app

---

Previous: [Lesson 1 · Course overview](./01-course-overview.md) · Next: **[Lesson 3 · Getting set up (Python)](./03-getting-set-up-python.md)** · [Course index](../README.md)
