# Video scripts · Module 3 (Specialists #2 + #3: Workout + Recovery)

> Verbatim narration + shot-by-shot screen-recording directions for lessons 13 to 15.
> Audience note: first-time viewers; gloss terms on first use. Record against the
> lesson's `course/lesson-NN` tag. Pace ~140 wpm. `[cite: ...]` = on-screen citation
> matching that lesson's `## References`. No em-dashes in any on-screen text.

---

## Lesson m3-l13 · Adding Workout: the pattern repeats · tag `course/lesson-13` · ~6 min

**NARRATION (verbatim)**

> You built the nutrition specialist step by step. The point of this lesson is how
> little there is to do for the second one, because the specialist is a template.
>
> Open `workout/subgraph.ts`. It is the same four-step shape as nutrition: retrieve,
> assess, maybe tools, compose. Only three things change. The namespace: the workout
> retriever passes "workout_kb" instead of "nutrition_kb." The tools: workout wires
> two, one that suggests how to progress a lift and one that looks up mobility drills.
> And the prompts, which describe the workout domain. Everything else is identical.
>
> One small upgrade over nutrition. Nutrition's assess step decided a single yes-or-no:
> run the calorie tool or not. Workout's assess can pick zero, one, or both tools, and
> the tools step runs whichever were chosen. It is the same decide-then-act pattern
> from the last module, just choosing from a two-item menu. [cite: Yao et al., 2023] If
> neither tool is needed, it skips straight to compose.
>
> And the adapter, `workoutNode`, is the nutrition adapter with one word changed: it
> reads the workout sub-question, runs the subgraph, and writes only findings dot
> workout. That repetition is the feature. A specialist is so self-contained that
> adding one is mechanical, which is exactly what makes "add your own specialist" in
> Module 6 a short lesson instead of a rewrite. [cite: LangChain, 2025]
>
> Next, the recovery specialist, and the reason each specialist gets its own private
> state.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-13`.
1. Side-by-side: `nutrition/subgraph.ts` and `workout/subgraph.ts`; or run
   `git diff --no-index src/agents/nutrition/subgraph.ts src/agents/workout/subgraph.ts`
   and scroll the diff, narrating that almost all of it is namespace, tools, prompts.
2. Highlight `workout` `AssessSchema` (both `progressionArgs` and `mobilityArgs`,
   nullable) and the `toolsNode` running whichever fired.
3. Highlight the conditional edge `progressionArgs || mobilityArgs ? "tools" : "compose"`.
4. Highlight `workoutNode` returning `{ findings: { workout: ... } }`.
5. In a LangSmith trace, ask a progression question; show the workout subgraph + tool.

---

## Lesson m3-l14 · Adding Recovery, and why each specialist gets its own state · tag `course/lesson-14` · ~6 min

**NARRATION (verbatim)**

> Recovery is the third specialist, and adding it is the same template again: the
> recovery namespace, two tools for sleep and heart-rate-variability data, recovery
> prompts. Its tools return fixture data so the lesson is deterministic and needs no
> wearable account. In production they become real device integrations, and nothing
> about the graph shape changes.
>
> I want to use this third copy to make one point that was easy to miss with one
> specialist: each specialist defines its *own* state, and that is what keeps parallel
> specialists from interfering.
>
> Look at the three state definitions. Nutrition, workout, and now recovery each have
> their own. They look similar but they are deliberately separate. Recovery's state has
> sleep and HRV fields. Workout's has progression and mobility fields. It would be
> tempting to factor out one shared specialist state. Resist that. A shared state would
> carry every specialist's fields into every specialist, which is exactly the
> cross-contamination we closed in the last module. Separate states keep each
> specialist describing only its own work. [cite: Saltzer & Schroeder, 1975]
>
> And this is what makes parallel safe. When the supervisor sends a question to workout
> and recovery at the same time, each runs its own subgraph with its own state. There
> is no shared, changing data for the two to fight over. Recovery writing a sleep value
> cannot touch workout's fields, because they live in completely different state
> objects. Isolation is not something the parallel branches coordinate to maintain. It
> falls out of each one having its own schema. [cite: LangChain, 2025] Next, how those
> separate findings come back together into one answer.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-14`.
1. Open `src/agents/recovery/subgraph.ts`; show it mirrors workout; highlight the
   `recovery_kb` retrieval and the sleep/HRV mock tools.
2. Show `RecoveryAnnotation`, `WorkoutAnnotation`, `NutritionAnnotation` side by side;
   point out each has only its own tool fields and none has `findings`.
3. In a LangSmith trace, ask a workout-plus-recovery question; show two subgraphs
   running in parallel, each with its own state; confirm the answer cites both.

---

## Lesson m3-l15 · State passing and fan-in · tag `course/lesson-15` · ~6 min

**NARRATION (verbatim)**

> The specialists fan out and run in parallel. Something has to collect their findings
> without losing any, and one node has to weave them into a single answer. That is the
> fan-in.
>
> Start with the shared state in `state.ts`. The findings field has a *reducer*, which
> is just a rule that says how to combine two writes to the same field in the same
> step. [cite: LangChain, 2025] Without one, two specialists writing findings at the
> same moment would conflict and the framework would reject it. With this merge
> reducer, workout writing its key and recovery writing its key merge into one map with
> both keys. Each adapter only ever writes its own key, so the keys never overlap. This
> is the other half of last module's isolation: a specialist cannot read another's
> findings, and now we see it cannot overwrite them either.
>
> Then the synthesizer, in `synthesize.ts`. It is the one and only node in the whole
> graph that reads the full findings map. It gathers whichever findings exist,
> collects their citations, and asks the model to weave a single answer that connects
> the specialists' advice rather than listing it. Its prompt forbids inventing facts
> the specialists did not provide, and it does not write its own citations: the
> citations are attached from the findings. So every source in the final answer traces
> back to a specialist that actually retrieved it. That is the grounding discipline
> closing at the top of the graph. [cite: Lewis et al., 2020]
>
> And if no specialist ran, an off-topic question, the synthesizer returns a graceful
> "no specialist was available" instead of failing. The graph always ends with an
> answer. That is the whole architecture. Next module, we measure whether it is any
> good.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-15`.
1. Open `src/state.ts`; highlight the `findings` annotation with the object-merge
   `reducer: (prev, next) => ({ ...prev, ...next })`.
2. Open `src/synthesizer/synthesize.ts`; highlight the loop gathering all findings,
   the `citations` concatenation, and the system prompt's "do not invent facts" rule.
3. In a LangSmith trace, ask a three-domain question; show three findings merge into
   the `findings` channel, then `synthesize` read all three. Read the final answer;
   confirm it connects domains and every claim is cited.

---

## Module 3 runtime check

l13 6 + l14 6 + l15 6 = ~18 min.
