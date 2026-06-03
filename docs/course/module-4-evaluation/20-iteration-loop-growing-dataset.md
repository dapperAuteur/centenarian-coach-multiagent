# Module 4 · Lesson 20 · The iteration loop and the growing dataset

> **Tag:** `course/lesson-20` · **Module 4: LangSmith evaluation** · ~4 min

The evaluators are only half the system. The other half is the loop they feed:
**find a bug, add an example that pins it, re-run.** A dataset that grows every
time you find a failure is the difference between evals you run once and evals that
get sharper as the system gets older.

## The loop, concretely

1. **Observe a failure.** From `pnpm eval` output, a low grounding score
   (Lesson 18), or a trace in a LangSmith experiment (Lesson 19), you spot a
   misroute or an ungrounded answer.
2. **Add an example that pins it.** Append one entry to
   [`evals/dataset.json`](../../../evals/dataset.json), tagged with where it came
   from and why:

   ```jsonc
   { "id": "c1",
     "question": "My right shoulder rounds forward when I press overhead. How do I fix it?",
     "expectedAgents": ["corrective"],
     "addedIn": "module-4",
     "note": "regression: a postural/corrective question leaked to the workout specialist" }
   ```
3. **Re-run.** `pnpm eval` (the gate) and `pnpm eval:langsmith` (the tracked
   experiment) now include the new case. Fix the supervisor prompt or retrieval
   until the example passes, without regressing the rest.

## Provenance is the feature

The `addedIn` and `note` fields on `EvalExample` (added in
[`evals/rubric.ts`](../../../evals/rubric.ts)) are optional and backward
compatible, but they carry the dataset's history. The original twenty examples are
the baseline; everything added later says which module and which bug introduced it.
The course's own dataset already grew this way: three regression examples were
added during the build,

- `wr3`, a sleep-plus-tightness question that was misrouting to workout only,
- `c1`, a postural question leaking away from the corrective specialist (also the
  first corrective-only case in the set),
- `nwr4`, a three-domain question that under-routed and dropped nutrition.

Each is a bug someone found, written down so it can never silently come back. A
test suite that only ever has its original cases is testing yesterday's
understanding of the system; a growing one tracks what you have actually learned
about how it breaks (LangChain, 2025).

## Why this is the point of the module

P5 of the rubric is not "do you have an eval." It is "is evaluation built into the
artifact, and does the dataset grow as bugs are found." The loop in this lesson is
that criterion: routing and citation gates (Lesson 17), a grounding judge
(Lesson 18), tracked experiments (Lesson 19), and a dataset with provenance that
expands every time the system surprises you.

### Build on the coach

Run the loop once for real. Ask the coach a question you suspect it routes wrong,
confirm it in the trace, add a tagged example to `evals/dataset.json`, and re-run
`pnpm eval`. You have now done the single most valuable thing in this module:
turned a one-off observation into a permanent regression test. Module 6 returns to
this, extending the eval suite as you extend the system.

## References

LangChain. (2025). *LangSmith documentation: Datasets and evaluation*. https://docs.langchain.com/langsmith/evaluation

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., Lin, Z., Li, Z., Li, D., Xing, E. P., Zhang, H., Gonzalez, J. E., & Stoica, I. (2023). Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. In *Advances in Neural Information Processing Systems* (Vol. 36). Curran Associates.

---

Previous: [Lesson 19 · Running evals in LangSmith](./19-running-evals-in-langsmith.md) · **End of Module 4** · Next: *Module 5 · Deployment + multi-tenant* · [Course index](../README.md)
