# Module 1 · Lesson 7 — The topology-enforces-ordering rule

> **Tag:** `course/lesson-07` · **Module 1: The supervisor** · ~5 min

"The supervisor runs before any specialist, and the synthesizer runs last." In a
lot of agent code that sentence is a *hope* — it holds because the prompt asks the
model to behave, or because the author remembered to call things in the right
order. This lesson is about making it a **structural guarantee** instead: the
graph's shape makes the wrong order unrepresentable.

## Ordering as a property of the graph, not the prompt

A LangGraph graph is a directed graph of nodes and edges; execution follows the
edges (LangChain, 2025). Look at the coach's wiring
([`src/graph.ts`](../../../src/graph.ts)):

```ts
new StateGraph(CoachAnnotation)
  .addNode("supervisor", supervisorNode)
  .addNode("nutrition", nutritionNode)
  // ...workout, recovery, corrective
  .addNode("synthesize", synthesizeNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeToSpecialists,
    ["nutrition", "workout", "recovery", "corrective", "synthesize"])
  .addEdge("nutrition", "synthesize")
  // ...workout, recovery, corrective -> synthesize
  .addEdge("synthesize", END)
  .compile();
```

Read the edges, not the intentions:

- `START` goes **only** to `supervisor`. There is no path that reaches a specialist
  without first passing through the supervisor — so `state.routing` always exists
  before a specialist runs.
- Specialists are reachable **only** through the conditional edge *out of* the
  supervisor.
- Every specialist's only out-edge is to `synthesize`; `synthesize`'s only
  out-edge is `END`. The synthesizer cannot run before the specialists, and
  nothing runs after it.

The ordering is not enforced by discipline. It is enforced because **no other
order is expressible** in this graph.

## Proving it with a test

A guarantee you do not test is a guarantee you only believe. The repo proves the
ordering in [`tests/topology.test.ts`](../../../tests/topology.test.ts), which
mocks the LLM and retrieval (so it runs with no API keys) and streams the graph's
node-completion order:

```ts
const stream = await coachGraph.stream(
  { sessionId: "topology", userQuery },
  { streamMode: "updates" },
);
for await (const chunk of stream) {
  for (const node of Object.keys(chunk)) order.push(node);
}
// assert: order[0] === "supervisor", last === "synthesize",
//         every specialist index between the two.
```

It asserts the invariant for **both** a single-specialist route and a full
fan-out, so ordering holds regardless of how wide the fan-out is. `streamMode:
"updates"` emits one chunk per node as it finishes, which is exactly the signal you
need to observe order (LangChain, 2025). Run it:

```bash
pnpm test tests/topology.test.ts
```

## Why this matters beyond tidiness

Two reasons. First, **trust**: because ordering is structural, every node can
assume the state it depends on already exists — the specialists never check
"did the supervisor run yet?" Second, **debuggability**: when a multi-agent system
misbehaves, "did it run in the right order?" is the first question, and here the
answer is a property of the compiled graph you can inspect and test, not a
behavior you have to reproduce.

### Build on the coach

Open `tests/topology.test.ts` and run it green. Then, in a scratch copy of
`src/graph.ts`, try to express a *wrong* order — for example, add an edge from a
specialist back to `supervisor`. Re-run the topology test and watch the
"supervisor first / synthesize last" invariant catch it. The exercise is to feel
that the test is checking the *structure*, not the model's behavior.

## References

LangChain. (2025). *LangGraph documentation: Graph API and streaming modes*. https://langchain-ai.github.io/langgraphjs/

Vitest. (2025). *Vitest documentation*. https://vitest.dev

---

Previous: [Lesson 6 — The routing schema](./06-routing-schema-zod.md) · Next: **[Lesson 8 — Conditional fan-out + temperature-0](./08-fan-out-and-temperature-zero.md)** · [Course index](../README.md)
