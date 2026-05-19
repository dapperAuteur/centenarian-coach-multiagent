# Lesson 2 — Supervisor routing: a structured decision before anything runs

A supervisor's job sounds simple — "pick which specialists answer the question"
— and most implementations get it subtly wrong. They ask the model, in prose,
which agents to use, then parse the prose. This lesson builds a supervisor that
instead returns a **typed, structured routing decision**, and explains why that
difference matters more than it looks.

## What the supervisor decides

For each question the coach's supervisor decides three things:

1. **Which specialists to consult** — one, two, or all of them.
2. **A focused sub-question for each chosen specialist** — the user's question,
   rewritten into that specialist's domain.
3. **A one-sentence rationale** — useful for the UI and for debugging routing.

It decides all of this **before any specialist runs**. That ordering is not a
convention you remember to follow; it is enforced by the graph's shape, which we
will see at the end.

## Structured output beats prose routing

The naive supervisor prompt ends with "...respond with the names of the agents
to use." You then parse that text. It fails in boring, frequent ways: the model
says "Nutrition and Workout specialists" (now you are string-matching), or it
adds a caveat sentence, or it picks an agent that does not exist.

Instead, define the decision as a schema and make the model fill it. This repo
uses Zod plus LangChain's `withStructuredOutput`:

```ts
// src/agents/supervisor/routing.schema.ts
export const AgentEnum = z.enum(["nutrition", "workout", "recovery"]);

export const RoutingSchema = z.object({
  agents: z.array(AgentEnum).min(1)
    .describe("Specialist(s) that should answer this question."),
  primaryAgent: AgentEnum
    .describe("The single most relevant specialist. Must be one of `agents`."),
  subQuestions: z.array(z.object({
    agent: AgentEnum,
    question: z.string().min(1),
  })),
  rationale: z.string().min(1).max(500),
});
```

`AgentEnum` makes an invalid agent name unrepresentable — the model cannot route
to a specialist that does not exist. `agents.min(1)` makes "route to nobody"
unrepresentable. The shape is the contract.

## The supervisor node

A LangGraph node is just a function from state to a state update. The supervisor
node calls the model, bound to the schema:

```ts
// src/agents/supervisor/supervisor.node.ts
export async function supervisorNode(state: CoachState): Promise<CoachUpdate> {
  const router = buildChatModel({ role: "supervisor", temperature: 0 })
    .withStructuredOutput(RoutingSchema, { name: "route_to_specialists" });

  const decision = await router.invoke([
    { role: "system", content: SUPERVISOR_SYSTEM },
    { role: "user", content: state.userQuery },
  ]);
  // ...normalize, then return { routing }
}
```

`withStructuredOutput` returns a runnable whose `.invoke()` resolves to a value
**typed as `z.infer<typeof RoutingSchema>`**. There is no parsing step and no
`any`. If the model's output does not satisfy the schema, it throws here —
loudly, at the boundary — instead of producing a plausible-looking wrong object
that breaks three nodes later.

## Normalize what the schema cannot express

A schema enforces field types; it cannot enforce relationships *between* fields.
`RoutingSchema` cannot say "`primaryAgent` must be a member of `agents`." So the
node does that itself:

```ts
const agents = [...new Set(decision.agents)];
const primaryAgent = agents.includes(decision.primaryAgent)
  ? decision.primaryAgent
  : agents[0];
```

This is a small thing with a large payoff: every downstream node can now *trust*
the routing object completely. Cross-field invariants belong in one place — the
node that produces the value — not scattered through the consumers.

## The temperature-zero rule

The supervisor runs at `temperature: 0`. Routing is a classification, not a
creative task; you want the same question to route the same way every time.
Save the temperature for the specialists' prose. Determinism in the router also
makes the system testable — you can assert that a pure-nutrition question routes
to nutrition only.

## Topology enforces ordering

"The supervisor runs before any specialist" is guaranteed by the graph, not by
discipline:

```ts
// src/graph.ts (simplified)
new StateGraph(CoachAnnotation)
  .addNode("supervisor", supervisorNode)
  .addNode("nutrition", nutritionNode)
  .addNode("workout", workoutNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeToSpecialists,
    ["nutrition", "workout", "synthesize"]);
```

`START` goes only to `supervisor`. The specialists are reachable only through
the conditional edge *out of* the supervisor. There is no path that reaches a
specialist before the supervisor has produced `routing`.

`routeToSpecialists` reads `state.routing.agents` and returns an **array** of
node names. Returning an array tells LangGraph to fan out — run those
specialists in parallel. That is the whole mechanism: a structured decision in,
a list of nodes out.

## Build this yourself

Continue the support desk from Lesson 1 (Billing, Technical, Account).

**Exercise.** Write the support desk's `RoutingSchema` — an `AgentEnum` of the
three specialists, an `agents` array, a `primaryAgent`, per-agent
`subQuestions`, and a `rationale`. Then write `supervisorNode`: call a
model with `withStructuredOutput`, write a system prompt that describes each
specialist's domain in one line, and add the `primaryAgent ∈ agents`
normalization. Test it against three questions — a pure billing question, a
pure technical question, and a cross-domain one ("I was charged after my API
key stopped working") — and assert the routing each time.

---

Next: **[Lesson 3 — Per-agent retrieval](./03-per-agent-retrieval.md)** — why each
specialist owns its own retrieval namespace.
