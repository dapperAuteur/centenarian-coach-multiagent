# Module 6 · Lesson 26 · Five extensions, with starting file paths

> **Tag:** `course/lesson-26` · **Module 6: Extension launching pad** · ~5 min

"Now go build something" is useless advice. This lesson is the opposite: five
concrete extensions, each with the file you would open first and an honest
difficulty. Pick one and you are not staring at a blank page.

## 1. A new specialist (Easy)

The Lesson 25 checklist, applied to a domain you care about: Mindset, Labs,
Mobility. **Start in:** copy [`src/agents/corrective/`](../../../src/agents/corrective/)
as your template (it is the minimal one), then work the six-point checklist.
**Difficulty:** easy, because the shape is fixed and contained.

## 2. Stream partial findings to the UI (Medium)

Today the UI streams events as each specialist completes
([`src/app/api/coach/query/route.ts`](../../../src/app/api/coach/query/route.ts)
already uses `streamMode: "updates"`). Extend it to stream *within* a specialist,
so a finding appears token by token. **Start in:** the route handler's stream
loop and the graph's stream mode. **Difficulty:** medium; the plumbing exists, the
work is in the event contract and the client.

## 3. Conversation memory across turns (Medium)

The coach answers one question per session (`sessionId` in
[`src/state.ts`](../../../src/state.ts)). Add a LangGraph checkpointer so a
follow-up question sees the prior turn, with user opt-in. **Start in:** the graph
compile call in [`src/graph.ts`](../../../src/graph.ts) (add a checkpointer) and the
state shape (carry history). **Difficulty:** medium; LangGraph checkpointers are
built for this (LangChain, 2025), but you decide what persists and for how long.

## 4. Give a specialist an MCP tool (Medium to hard)

The specialists wire local tools today (the calorie calculator, the progression
suggester). Connect one to an external tool over the Model Context Protocol so it
can call, say, a real nutrition database (Anthropic, 2024). **Start in:** a
specialist's `assess` and `tools` nodes (for example
[`src/agents/nutrition/subgraph.ts`](../../../src/agents/nutrition/subgraph.ts)),
swapping a local tool for an MCP client. **Difficulty:** medium to hard; the assess
or tools pattern is the hook, the work is the MCP transport and auth.

## 5. Multi-tenant, per-user state (Hard)

Take the coach from single-admin demo to many users: a `userId` on the state,
per-user session history, and optionally per-user knowledge namespaces. **Start
in:** [`src/state.ts`](../../../src/state.ts) and
[`src/db/schema.ts`](../../../src/db/schema.ts) (Lesson 23 sketched the diff).
**Difficulty:** hard, not because any one change is large but because tenancy
touches state, storage, auth, and retrieval together.

## How to choose

If you want to feel the architecture's leverage fastest, do #1: a new specialist is
a contained afternoon. If you want production polish, #2 or #4. If you are building
a real product on this, #5 is the path, and the isolation work in Modules 2 to 3 is
what makes it tractable. Whatever you pick, the next lesson is non-negotiable: when
you extend the system, extend the evals with it.

## References

Anthropic. (2024). *Model Context Protocol*. https://modelcontextprotocol.io

LangChain. (2025). *LangGraph documentation: Persistence and checkpointers*. https://langchain-ai.github.io/langgraphjs/

---

Previous: [Lesson 25 · How to add a new specialist](./25-how-to-add-a-new-specialist.md) · Next: **[Lesson 27 · Extending the eval suite as you extend the system](./27-extending-the-eval-suite.md)** · [Course index](../README.md)
