# Module 3 · Lesson 13 · Adding Workout: the pattern repeats

> **Tag:** `course/lesson-13` · **Module 3: Specialists #2 + #3** · ~6 min

You built the Nutrition specialist node by node in Module 2. The point of this
lesson is how little there is to do for the second one. The specialist is a
template, and Workout stamps it out.

## Same shape, different namespace and tools

[`src/agents/workout/subgraph.ts`](../../../src/agents/workout/subgraph.ts) is the
same four-node graph as Nutrition: `retrieve, assess, (tools | compose), compose`.
Only three things change:

1. **The namespace.** `retrieveWorkoutKb` queries `workout_kb`, not
   `nutrition_kb` (Lesson 9). One line of difference in the retrieval module.
2. **The tools.** Workout wires two: `suggestProgression` (how to advance a lift)
   and `mobilityLookup` (drills for a body area). Its `assess` node returns both
   `progressionArgs` and `mobilityArgs`, either of which can be null:

   ```ts
   const AssessSchema = z.object({
     progressionArgs: ProgressionInputSchema.nullable(),
     mobilityArgs: MobilityInputSchema.nullable(),
   });
   ```
3. **The prompts.** `WORKOUT_ASSESS_SYSTEM` and `WORKOUT_COMPOSE_SYSTEM` describe
   the workout domain. Everything else is identical to Nutrition.

## One assess, possibly two tools

Nutrition's `assess` decided one boolean (run the calorie tool or not). Workout's
`assess` can select zero, one, or both tools, and the `tools` node runs whichever
were chosen:

```ts
async function toolsNode(state: WorkoutState): Promise<WorkoutUpdate> {
  const toolCalls: ToolCallRecord[] = [];
  if (state.progressionArgs) { /* run suggestProgression, record the call */ }
  if (state.mobilityArgs)    { /* run mobilityLookup, record the call */ }
  return { toolCalls };
}
```

The assess-then-act split (decide what is warranted, then do it) is the same ReAct
pattern from Module 2, now selecting from a two-tool menu (Yao et al., 2023). The
conditional edge that follows `assess` checks `progressionArgs || mobilityArgs`:
if neither fired, the graph skips straight to `compose`.

## The adapter is a copy with one word changed

```ts
export async function workoutNode(state: CoachState): Promise<CoachUpdate> {
  const subQuestion = state.routing?.subQuestions.workout ?? state.userQuery;
  const result = await workoutSubgraph.invoke({ subQuestion });
  // ...package as a SpecialistFinding...
  return { findings: { workout: finding } };
}
```

It reads `subQuestions.workout`, writes `findings.workout`, and is otherwise the
Nutrition adapter with "nutrition" swapped for "workout". That repetition is the
feature: a specialist is so contained that adding one is mechanical, which is
exactly what makes Module 6's "add a new specialist" a short lesson rather than a
rewrite.

### Build on the coach

Diff the two specialists: `git diff --no-index src/agents/nutrition/subgraph.ts
src/agents/workout/subgraph.ts`. Almost everything that differs is the namespace,
the tool wiring, and the prompts. That small, predictable diff is the template you
will follow when you add your own specialist.

## References

LangChain. (2025). *LangGraph documentation: Subgraphs and tool nodes*. https://langchain-ai.github.io/langgraphjs/

Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2023). ReAct: Synergizing reasoning and acting in language models. In *International Conference on Learning Representations (ICLR)*. https://doi.org/10.48550/arXiv.2210.03629

---

Previous: [Module 2 · Lesson 12 · Type-enforced isolation](../module-2-nutrition/12-type-enforced-isolation.md) · Next: **[Lesson 14 · Adding Recovery + subgraph isolation](./14-adding-recovery-and-isolation.md)** · [Course index](../README.md)
