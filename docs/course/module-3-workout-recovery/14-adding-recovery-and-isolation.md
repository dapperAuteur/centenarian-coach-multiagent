# Module 3 · Lesson 14 · Adding Recovery, and why each specialist gets its own state schema

> **Tag:** `course/lesson-14` · **Module 3: Specialists #2 + #3** · ~6 min

Recovery is the third specialist, and adding it is the same template again
([`src/agents/recovery/subgraph.ts`](../../../src/agents/recovery/subgraph.ts)):
the `recovery_kb` namespace, two tools (`sleepDataMock` and `hrvTrendMock`), and
recovery-domain prompts. This lesson uses that third copy to make a point that was
easy to miss with one specialist: **each specialist defines its own state schema,
and that is what keeps three parallel specialists from stomping on each other.**

## Three Annotations, deliberately separate

Each specialist has its own `Annotation.Root`: `NutritionAnnotation`,
`WorkoutAnnotation`, and now `RecoveryAnnotation`. They look similar but they are
not shared:

```ts
const RecoveryAnnotation = Annotation.Root({
  subQuestion: Annotation<string>(),
  citations: Annotation<Citation[]>({ /* append reducer */ }),
  toolCalls: Annotation<ToolCallRecord[]>({ /* append reducer */ }),
  sleepArgs: Annotation<SleepDataInput | null>(),
  hrvArgs: Annotation<HrvTrendInput | null>(),
  draftText: Annotation<string>(),
});
```

It would be tempting to factor out "the shared specialist state" into one schema
all three import. Resist that. Recovery's state has `sleepArgs` and `hrvArgs`;
Workout's has `progressionArgs` and `mobilityArgs`. A shared schema would carry
every specialist's tool args into every specialist, which is exactly the
cross-domain leakage Lesson 12 closed. Separate schemas keep each specialist's
state describing only its own work, and (per Lesson 12) none of them has a
`findings` channel, so none can read another's output.

## Why separate state matters under fan-out

When the supervisor routes a cross-domain question to Workout and Recovery, both
run **in parallel** (Module 1's conditional fan-out). Each runs its own compiled
subgraph against its own `Annotation`, so there is no shared mutable state for the
two to race on. Recovery writing `sleepArgs` cannot touch Workout's
`progressionArgs`, because those fields live in different state objects entirely.
Isolation is not something the parallel branches coordinate to maintain; it is a
consequence of each branch having its own schema.

The mock tools (`sleepDataMock`, `hrvTrendMock`) return fixture sleep and HRV
summaries so the specialist's behavior is deterministic and key-free for the
course. In a production build these become real device integrations, and nothing
about the graph shape changes: a tool is a tool, whether it reads a fixture or an
API.

### Build on the coach

Ask a Workout + Recovery question ("I slept five hours, should I do a heavy leg
session today?") and open the LangSmith trace. You will see two nested subgraphs
running side by side, each with its own state. Confirm the final answer cites both
specialists. Then look at `WorkoutAnnotation` and `RecoveryAnnotation` and
convince yourself there is no field either one could use to read the other's
state. That absence is the isolation guarantee, repeated per specialist.

## References

LangChain. (2025). *LangGraph documentation: State, parallel branches, and subgraphs*. https://langchain-ai.github.io/langgraphjs/

Saltzer, J. H., & Schroeder, M. D. (1975). The protection of information in computer systems. *Proceedings of the IEEE, 63*(9), 1278–1308. https://doi.org/10.1109/PROC.1975.9939

---

Previous: [Lesson 13 · Adding Workout](./13-adding-workout.md) · Next: **[Lesson 15 · State passing and fan-in](./15-state-passing-and-fan-in.md)** · [Course index](../README.md)
