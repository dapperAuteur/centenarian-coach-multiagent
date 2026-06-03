# Module 2 · Lesson 12 — The type-enforced "can't read other specialists' findings" trick

> **Tag:** `course/lesson-12` · **Module 2: Specialist #1 (Nutrition)** · ~4 min

"Specialists don't read each other's work" is a property most systems enforce with
a *prompt* ("do not consider other agents' outputs") and hope. Fit T. Cent 3.0
enforces it with the **type system**: a specialist physically cannot reach another
specialist's findings, because that data is not in its state schema. The
synthesizer is the only node that sees everything.

## Isolation by what's *absent* from the schema

Look at the Nutrition subgraph's state
([`src/agents/nutrition/subgraph.ts`](../../../src/agents/nutrition/subgraph.ts)):

```ts
const NutritionAnnotation = Annotation.Root({
  subQuestion: Annotation<string>(),
  citations: Annotation<Citation[]>({ /* reducer */ }),
  toolCalls: Annotation<ToolCallRecord[]>({ /* reducer */ }),
  needsCalorieTool: Annotation<boolean>(),
  calorieArgs: Annotation<CalorieInput | null>(),
  draftText: Annotation<string>(),
});
```

There is **no `findings` channel here.** The subgraph's nodes are typed against
`NutritionState`, so `state.findings` is not just empty — it does not type-check.
The Workout specialist's findings are unreachable from inside Nutrition not by
discipline but by construction. This is the principle of least privilege applied
to graph state: a component is given access only to what it needs (Saltzer &
Schroeder, 1975). The Nutrition specialist needs its sub-question and its sources;
it does not need anyone else's answer, so it cannot have it.

## The adapter writes one slot, by type

The top-level state *does* have a `findings` map, with an object-merge reducer
([`src/state.ts`](../../../src/state.ts)):

```ts
findings: Annotation<FindingsMap>({
  reducer: (prev, next) => ({ ...prev, ...next }),
  default: () => ({}),
}),
```

The adapter `nutritionNode` returns `{ findings: { nutrition: finding } }` — only
its own key. When specialists fan out in parallel (Module 1), each writes a
different key, and the reducer merges them without collision. A specialist
*cannot* clobber another's slot, because it only ever names its own. The
synthesizer (Module 3) is the single node that reads the whole `findings` map and
weaves them.

## Why "by type" beats "by prompt"

A prompt instruction is a request the model can ignore, and you only discover the
leak when an answer cross-contaminates in production. A missing state channel is a
compile error — the leak is impossible to write. The guarantee holds regardless of
the model, the temperature, or how the prompt drifts over time. For a health
assistant where attributability is the whole value proposition, "impossible to
write" is the standard you want.

### Build on the coach

In a scratch edit of `nutrition/subgraph.ts`, try to read another specialist's
finding from inside a node — e.g., reference `state.findings` in `composeNode`.
TypeScript rejects it: `findings` is not on `NutritionState`. That red squiggle
*is* the isolation guarantee. Revert the edit. (Module 6 relies on this: a new
specialist gets the same "no findings channel" subgraph for free.)

## References

Saltzer, J. H., & Schroeder, M. D. (1975). The protection of information in computer systems. *Proceedings of the IEEE, 63*(9), 1278–1308. https://doi.org/10.1109/PROC.1975.9939

LangChain. (2025). *LangGraph documentation: State, channels, and reducers*. https://langchain-ai.github.io/langgraphjs/

---

Previous: [Lesson 11 — Building the Nutrition subgraph](./11-building-the-nutrition-subgraph.md) · **End of Module 2** · Next: *Module 3 — Specialists #2 + #3 (Workout + Recovery)* · [Course index](../README.md)
