# Module 1 · Lesson 6 — Designing the routing schema with Zod

> **Tag:** `course/lesson-06` · **Module 1: The supervisor** · ~6 min

A supervisor's job sounds simple — "pick which specialists answer the question" —
and most implementations get it subtly wrong. They ask the model, in prose, which
agents to use, then parse the prose. This lesson builds a supervisor that returns
a **typed, structured routing decision**, and explains why that matters more than
it looks.

## What the supervisor decides

For each question the coach's supervisor decides three things
([`src/agents/supervisor/routing.schema.ts`](../../../src/agents/supervisor/routing.schema.ts)):

1. **Which specialists to consult** — one, two, or more.
2. **A focused sub-question per chosen specialist** — the user's question,
   rewritten into that specialist's domain.
3. **A one-sentence rationale** — for the UI and for debugging routing.

It decides all of this *before any specialist runs* — enforced by the graph's
shape, which is Lesson 7.

## Structured output beats prose routing

The naive prompt ends with "...respond with the names of the agents to use," and
you parse the text. It fails in boring, frequent ways: the model says "Nutrition
and Workout specialists" (now you are string-matching), adds a caveat sentence, or
picks an agent that does not exist. Constraining a model to emit a typed object —
function/tool calling, a.k.a. structured output — removes that whole failure class
by making the output conform to a schema (LangChain, 2025). This repo uses Zod
(Colinhacks, 2025) plus LangChain's `withStructuredOutput`:

```ts
// src/agents/supervisor/routing.schema.ts
export const AgentEnum = z.enum(["nutrition", "workout", "recovery", "corrective"]);

export const RoutingSchema = z.object({
  agents: z.array(AgentEnum).min(1)
    .describe("Specialist(s) that should answer this question."),
  primaryAgent: AgentEnum
    .describe("The single most relevant specialist. Must be one of `agents`."),
  subQuestions: z.array(z.object({ agent: AgentEnum, question: z.string().min(1) })),
  rationale: z.string().min(1).max(500),
});
```

`AgentEnum` makes an invalid agent name **unrepresentable** — the model cannot
route to a specialist that does not exist. `agents.min(1)` makes "route to nobody"
unrepresentable. The shape is the contract. The `.describe()` strings are not
decoration: they are serialized into the JSON Schema the model sees, so they are
how you steer the field's meaning.

## The supervisor node

A LangGraph node is a function from state to a state update. The supervisor node
([`src/agents/supervisor/supervisor.node.ts`](../../../src/agents/supervisor/supervisor.node.ts))
binds the model to the schema:

```ts
const router = await withRoleFallback(
  { role: "supervisor", temperature: 0 },
  (m) => m.withStructuredOutput(RoutingSchema, { name: "route_to_specialists" }),
);
const decision = await router.invoke([
  { role: "system", content: SUPERVISOR_SYSTEM },
  { role: "user", content: state.userQuery },
]);
```

`withStructuredOutput` returns a runnable whose `.invoke()` resolves to a value
**typed as `z.infer<typeof RoutingSchema>`** — no parsing, no `any`. If the output
does not satisfy the schema it throws *here*, loudly, at the boundary, instead of
producing a plausible-looking wrong object that breaks three nodes later.

## Normalize what the schema cannot express

A schema enforces field types; it cannot enforce relationships *between* fields.
`RoutingSchema` cannot say "`primaryAgent` must be a member of `agents`," so the
node does that itself:

```ts
const agents = [...new Set(decision.agents)];
const primaryAgent = agents.includes(decision.primaryAgent)
  ? decision.primaryAgent : agents[0];
```

Small thing, large payoff: every downstream node can now *trust* the routing
object completely. Cross-field invariants belong in one place — the node that
produces the value — not scattered through the consumers.

> **Provider trap.** A Zod schema that round-trips cleanly through one provider's
> structured-output API may not survive another's. This repo hit it: `.positive()`
> compiles to JSON Schema's `exclusiveMinimum`, which Gemini's structured-output
> subset rejected while Claude accepted it (see the README's "A real bug I
> caught"). Keep router schemas to the common subset.

### Build on the coach

Extend `RoutingSchema` with a `confidence: z.number().min(0).max(1)` field and have
the system prompt set it low when a question is ambiguous. Then ask: where would a
downstream node *use* it — to ask the user a clarifying question before fanning
out? Sketch the change; you do not have to wire it. The point is feeling how the
schema is the contract every other node reads.

## References

Colinhacks. (2025). *Zod: TypeScript-first schema validation* [Computer software]. https://zod.dev

LangChain. (2025). *LangGraph documentation: Structured output*. https://langchain-ai.github.io/langgraphjs/

---

Previous: [Lesson 5 — Single vs. multi-agent](./05-single-vs-multi-agent.md) · Next: **[Lesson 7 — The topology-enforces-ordering rule](./07-topology-enforces-ordering.md)** · [Course index](../README.md)
