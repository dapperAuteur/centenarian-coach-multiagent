# Module 4 · Lesson 17 · Deterministic evaluators: routing and citation

> **Tag:** `course/lesson-17` · **Module 4: LangSmith evaluation** · ~6 min

Two of the three failure axes from Lesson 16 are checkable with plain code, no
model required. Those deterministic evaluators are the cheapest, most reliable
part of the suite, so they run on every pull request. They live in
[`evals/rubric.ts`](../../../evals/rubric.ts) and are pure functions, with no API
and no network, which is why they unit-test cleanly and gate CI without spending
tokens.

## Routing accuracy: an exact-set match

```ts
export function routingScore(state: CoachState, example: EvalExample): EvalScore {
  const got = [...(state.routing?.agents ?? [])].sort();
  const want = [...example.expectedAgents].sort();
  const correct = got.length === want.length && got.every((a, i) => a === want[i]);
  return { key: "routing_correct", score: correct ? 1 : 0,
    comment: correct ? undefined : `expected [${want.join(", ")}], got [${got.join(", ")}]` };
}
```

It compares the supervisor's chosen agents against the example's `expectedAgents`
as a set (order-independent), and on a miss the `comment` says exactly what was
expected and what came back, so a failing eval is also a bug report. This is only
meaningful because routing is deterministic (Module 1's temperature-0 rule): the
same question routes the same way every run, so a 0 is a real defect, not noise.

## Citation coverage: the promise, checked

```ts
export function citationScore(state: CoachState): EvalScore {
  const findings = Object.values(state.findings).filter(Boolean);
  const everyFindingCited = findings.length > 0 && findings.every((f) => f.citations.length > 0);
  const answerCited = (state.finalAnswer?.citations.length ?? 0) > 0;
  return { key: "citations_present", score: everyFindingCited && answerCited ? 1 : 0 };
}
```

It encodes the design's structural promise: every specialist finding carries at
least one citation, and the final answer carries citations. Coverage does not check
whether the citations are *good* (that is grounding, Lesson 18); it checks they are
*present*. Cheap, binary, and exactly the kind of regression a refactor can break
without anyone noticing.

## The gate

`pnpm eval` runs the evaluators across `evals/dataset.json` via
[`tests/coach.eval.test.ts`](../../../tests/coach.eval.test.ts) and fails if mean
routing accuracy drops below 0.8 or citation coverage below 0.9:

```ts
expect(routingAccuracy).toBeGreaterThanOrEqual(0.8);
expect(citationCoverage).toBeGreaterThanOrEqual(0.9);
```

The run makes a real graph invocation per example, so it is opt-in (`RUN_EVALS=1`)
and stays out of the fast default `pnpm test`. But the rubric functions themselves
have pure unit tests (`evals.rubric.test.ts`) that run every time, so the
*evaluators* are always protected even when the expensive full eval is not run. A
pull request that drops routing accuracy should fail this gate, not surprise a
user; that regression gate is the entire point (LangChain, 2025).

### Build on the coach

Run `pnpm test evals.rubric.test.ts` (fast, no keys) to see the evaluators tested
in isolation. Then, with keys set, run `pnpm eval` and read the per-question table.
Find the lowest-scoring question and decide, before reading on, whether it is a
routing problem or a grounding problem. Lesson 18 gives you the grounding number to
confirm.

## References

LangChain. (2025). *LangSmith documentation: Code evaluators*. https://docs.langchain.com/langsmith/evaluation

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., Lin, Z., Li, Z., Li, D., Xing, E. P., Zhang, H., Gonzalez, J. E., & Stoica, I. (2023). Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. In *Advances in Neural Information Processing Systems* (Vol. 36). Curran Associates.

---

Previous: [Lesson 16 · Why multi-agent fails quietly](./16-why-multi-agent-fails-quietly.md) · Next: **[Lesson 18 · The LLM-judge grounding evaluator](./18-llm-judge-grounding.md)** · [Course index](../README.md)
