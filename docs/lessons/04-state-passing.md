# Lesson 4 — State passing: shared state without stomping

A multi-agent graph has one piece of shared state that every node reads and
writes. When specialists run in parallel, naive state handling lets them
overwrite each other's work. This lesson covers the two mechanisms that prevent
that: **reducers** on the shared state, and **separate state schemas** for the
subgraphs.

## The shared state

LangGraph state is declared as an annotation — a set of named channels, each
with a type and an optional reducer. The coach's top-level state:

```ts
// src/state.ts
export const CoachAnnotation = Annotation.Root({
  sessionId: Annotation<string>(),
  userQuery: Annotation<string>(),
  routing: Annotation<RoutingDecision | undefined>(),
  findings: Annotation<FindingsMap>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  finalAnswer: Annotation<FinalAnswer | undefined>(),
});
```

Each node returns a *partial* update. LangGraph applies it to the channel. For a
channel with no reducer, the default behaviour is last-write-wins: the update
replaces the channel's value. That is fine for `routing` (one node writes it) —
and a bug waiting to happen for `findings`.

## Why `findings` needs a reducer

The supervisor fans out: when a question is cross-domain, the Nutrition and
Workout specialists run **in the same superstep, in parallel**. Each finishes
and returns an update:

```ts
// nutritionNode returns:
return { findings: { nutrition: nutritionFinding } };
// workoutNode returns:
return { findings: { workout: workoutFinding } };
```

With last-write-wins, LangGraph applies one update, then the other — and the
second `{ findings: { workout } }` *replaces* the channel, discarding the
nutrition finding. The cross-domain answer silently loses half its input.

The fix is the reducer on the `findings` channel:

```ts
reducer: (prev, next) => ({ ...prev, ...next }),
```

Now each update is *merged* into the channel instead of replacing it. The two
parallel updates compose to `{ nutrition, workout }` regardless of order,
because each specialist writes only its own key. The rule that makes this safe:
**a specialist writes only its own slot** — `nutritionNode` never returns a
`workout` key.

Picking a reducer is the core state-design decision. Ask, per channel: is it
written once (last-write-wins is fine) or by several nodes (it needs a merge or
append reducer)? Get that right and parallelism is free; get it wrong and you
get nondeterministic data loss that is miserable to debug.

## Subgraph isolation: specialists can't read each other

The headline rule of this architecture is "specialists never read each other's
findings." You could enforce that with discipline. This repo enforces it with
**types**: each specialist subgraph has its *own* state schema, and that schema
has no `findings` channel at all.

```ts
// src/agents/nutrition/subgraph.ts
const NutritionAnnotation = Annotation.Root({
  subQuestion: Annotation<string>(),
  citations: Annotation<Citation[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  toolCalls: Annotation<ToolCallRecord[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  needsCalorieTool: Annotation<boolean>(),
  calorieArgs: Annotation<CalorieInput | null>(),
  draftText: Annotation<string>(),
});
```

There is no `findings` here. The nutrition subgraph's nodes cannot read another
specialist's output because that data is not in their state — the isolation is
structural, not a convention someone has to remember. (Note `citations` and
`toolCalls` use append reducers — the retrieve and tool nodes each contribute,
and their contributions accumulate.)

## The adapter node: bridging two state shapes

A subgraph has its own state; the top-level graph has `CoachState`. Something
must translate. That is the **adapter node** — a thin function that runs the
subgraph and maps its result into a top-level update:

```ts
// src/agents/nutrition/subgraph.ts
export async function nutritionNode(state: CoachState): Promise<CoachUpdate> {
  const subQuestion = state.routing?.subQuestions.nutrition ?? state.userQuery;
  const startedAt = Date.now();

  const result = await nutritionSubgraph.invoke({ subQuestion });

  const finding: SpecialistFinding = {
    agent: "nutrition",
    text: result.draftText ?? "",
    citations: result.citations,
    toolCalls: result.toolCalls,
    durationMs: Date.now() - startedAt,
  };
  return { findings: { nutrition: finding } };
}
```

The adapter reads from `CoachState` (only what it needs — its sub-question),
runs the subgraph in the subgraph's own state shape, and writes back exactly one
key of `findings`. The two state worlds touch only here, in a function small
enough to read at a glance.

## Fan-in: the synthesizer

After the specialists, a `synthesize` node runs. It is the *one* node allowed to
read across specialists — `state.findings.nutrition` and `state.findings.workout`
together — because synthesis is its entire job. The merge reducer guarantees
both findings are present by the time it runs. Fan-out, isolated work, fan-in:
the shape of every supervisor system.

## Build this yourself

Continue the support desk (Billing, Technical, Account).

**Exercise.** Design the desk's `SupportAnnotation`: a `findings` channel with a
merge reducer, plus `routing` and `finalAnswer`. Then design one specialist
subgraph's state schema and confirm it has no `findings` channel. Write the
adapter node for that specialist. Finally, trace by hand: if Billing and
Technical run in parallel, what is in `findings` after each — with the reducer,
and without it?

---

Next: **[Lesson 5 — Evals](./05-evals.md)** — building a LangSmith eval dataset
that catches the failures you actually care about.
