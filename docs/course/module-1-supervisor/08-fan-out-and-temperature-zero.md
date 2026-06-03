# Module 1 · Lesson 8 — Conditional fan-out + temperature-0 as classification

> **Tag:** `course/lesson-08` · **Module 1: The supervisor** · ~5 min

Two small decisions give the supervisor most of its power: how it hands work to
the specialists (conditional fan-out), and how it makes the routing decision
itself reproducible (temperature 0). This lesson covers both.

## Conditional fan-out: a list of nodes out

The supervisor produced a `routing.agents` array in Lesson 6. A **conditional
edge** turns that array into parallel execution
([`src/graph.ts`](../../../src/graph.ts)):

```ts
function routeToSpecialists(state: CoachState): string[] {
  const chosen = state.routing?.agents ?? [];
  const targets = chosen.filter((a) => SPECIALISTS.includes(a));
  return targets.length > 0 ? targets : ["synthesize"];
}

.addConditionalEdges("supervisor", routeToSpecialists,
  ["nutrition", "workout", "recovery", "corrective", "synthesize"]);
```

The mechanism is small and worth stating exactly: a conditional-edge function that
returns **an array of node names** tells LangGraph to fan out — run all of those
nodes in parallel in the next superstep (LangChain, 2025). A single-domain
question returns `["nutrition"]` (one node runs); a cross-domain question returns
`["workout", "recovery"]` (both run at once); a question that matches nothing
returns `["synthesize"]`, so the graph degrades gracefully to a "no specialist"
answer instead of dead-ending.

Two things fall out of this design:

- **The fan-out width is data, not code.** Adding a fifth specialist does not
  change `routeToSpecialists`; it changes what the supervisor is *allowed* to put
  in `agents`. (Module 6 leans on this.)
- **Parallelism is free here** because the specialists are isolated — they write
  to different slots of state and never read each other (Module 2's isolation
  trick, Module 3's merge reducer). Fan-out is only safe *because* of that
  isolation.

## Temperature 0: routing is classification

The supervisor runs at `temperature: 0`
([`supervisor.node.ts`](../../../src/agents/supervisor/supervisor.node.ts)):

```ts
await withRoleFallback({ role: "supervisor", temperature: 0 }, ...)
```

Temperature scales the randomness of token sampling; lowering it toward 0
collapses sampling toward the highest-probability token — greedy, near-deterministic
decoding — while higher temperatures trade determinism for diversity (Holtzman et
al., 2020). Routing is a **classification**, not a creative task: you want the same
question to route the same way every time. Three payoffs:

1. **Reproducibility.** "How much protein?" routes to `nutrition` today and
   tomorrow. Users and tests can rely on it.
2. **Testability.** The eval suite (Module 4) can assert that a pure-nutrition
   question routes to nutrition only — an assertion that is meaningless if the
   router wanders run to run.
3. **Cheaper debugging.** When a route is wrong at temperature 0, it is wrong
   *deterministically* — you can reproduce it, fix the prompt or schema, and
   confirm the fix. A flaky router hides its bugs.

Save the temperature for the specialists' prose composition, where some variation
reads as natural language rather than as a bug. The supervisor is the one node that
should be boring.

### Build on the coach

Ask the coach a clearly cross-domain question ("I slept five hours, want to build
muscle, and have legs planned — what should I do?") and open the LangSmith trace
(Lesson 4). Confirm the fan-out width matches what you would have chosen, and read
the supervisor's `rationale`. Then, as a thought experiment, predict what would
happen to routing reproducibility if you set `temperature: 0.8` on the supervisor —
and why the eval suite's routing-accuracy assertion would start flickering. Module
4 is where you turn that intuition into a number.

## References

Holtzman, A., Buys, J., Du, L., Forbes, M., & Choi, Y. (2020). The curious case of neural text degeneration. In *International Conference on Learning Representations (ICLR)*. https://openreview.net/forum?id=rygGQyrFvH

LangChain. (2025). *LangGraph documentation: Conditional edges and parallel branches*. https://langchain-ai.github.io/langgraphjs/

---

Previous: [Lesson 7 — Topology enforces ordering](./07-topology-enforces-ordering.md) · **End of Module 1** · Next: *Module 2 — Specialist #1: Nutrition* · [Course index](../README.md)
