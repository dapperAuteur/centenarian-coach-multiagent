# Module 5 · Lesson 21 · LangGraph Platform and langgraph.json

> **Tag:** `course/lesson-21` · **Module 5: Deployment + multi-tenant** · ~6 min

Until now the coach graph has run inside the Next.js app's API routes. This module
also makes it deployable as a standalone graph on **LangGraph Platform** (LangSmith
Deployment), and the good news for this lesson is that you can run that surface
locally with no Docker and no spend.

## Two files declare the deployment

[`langgraph.json`](../../../langgraph.json) is the whole declaration:

```json
{
  "node_version": "20",
  "dependencies": ["."],
  "graphs": { "coach": "./src/deployment/graph.ts:coachGraph" },
  "env": ".env"
}
```

It names one graph, `coach`, and points at an export. That export is a deliberately
thin file, [`src/deployment/graph.ts`](../../../src/deployment/graph.ts):

```ts
export { coachGraph } from "@/graph";
```

Why a thin re-export instead of pointing `langgraph.json` straight at
`src/graph.ts`? It isolates the single import the Platform build must resolve. The
whole graph tree imports through the `@/` path alias, and alias resolution inside
the Platform build is not guaranteed. If the build fails with
`ERR_MODULE_NOT_FOUND` on `@/graph`, this one file is where you switch to a
relative import (`export { coachGraph } from "../graph";`). One known risk,
localized to one line (LangChain, 2025a).

## Run it locally with no Docker

```bash
pnpm deploy:dev   # runs `langgraphjs dev`
```

`langgraphjs dev` starts the Agent Server **in memory, in your environment, with no
Docker and no Postgres or Redis** (LangChain, 2025b). It boots in seconds, hot
reloads, and exercises the exact `langgraph.json` resolution, so it surfaces the
`@/` alias risk before any cloud step. This matters for this build specifically:
the dev machine cannot run Docker Desktop, and `pnpm deploy:dev` needs none. The
only CLI command that requires Docker is `langgraph up` (the standalone container),
which this course does not use.

## The deployed graph is a distinct surface

The Next.js app keeps importing `@/graph` exactly as before; nothing about the
running app changes. `langgraph.json` adds a *second* way to run the same compiled
graph, as a managed Agent Server with its own API, persistence, and streaming. The
app and the platform deployment are two front doors onto one graph, which is why
the re-export is pure: every test, eval, and the app all keep exercising the same
`coachGraph`.

### Build on the coach

Run `pnpm deploy:dev` and open the local Agent Server it prints. Send the coach a
question through it and confirm you get the same routed, cited answer the app
gives. You have now run the LangGraph Platform surface end to end, locally, for
free, before touching any cloud account. The next lesson covers what changes when
the graph runs somewhere other than your laptop.

## References

LangChain. (2025a). *LangGraph Platform documentation: Deployment options*. https://docs.langchain.com/langgraph-platform/

LangChain. (2025b). *LangGraph CLI documentation: Local development server*. https://docs.langchain.com/langsmith/cli

---

Previous: [Module 4 · Lesson 20 · The iteration loop](../module-4-evaluation/20-iteration-loop-growing-dataset.md) · Next: **[Lesson 22 · Deploying and wiring env + database](./22-deploying-env-and-database.md)** · [Course index](../README.md)
