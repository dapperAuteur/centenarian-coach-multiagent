# Module 4 · Lesson 18 · The LLM-judge grounding evaluator

> **Tag:** `course/lesson-18` · **Module 4: LangSmith evaluation** · ~7 min

Routing and citation coverage are checkable with code. **Grounding is not.**
Whether every claim in an answer is actually supported by a retrieved snippet is a
semantic judgement, and the practical way to score it at scale is to ask a model,
the LLM-as-judge approach (Zheng et al., 2023). For a health coach this is the
deal-breaker evaluator: a fluent answer built on facts no source backs is the exact
failure the citation-grounding discipline exists to catch.

## A judge with a tight rubric, pinned to temperature 0

The grounding evaluator lives in
[`evals/grounding.ts`](../../../evals/grounding.ts), deliberately separate from the
pure `rubric.ts` (which must stay API-free). It gathers the snippets the
specialists retrieved, gives them plus the final answer to a judge, and asks for a
structured verdict:

```ts
const GroundingSchema = z.object({
  score: z.number().min(0).max(1)
    .describe("Fraction of the answer's factual claims supported by at least one snippet."),
  unsupportedClaims: z.array(z.string())
    .describe("Claims in the answer that no snippet supports."),
});
```

Three choices make the judge trustworthy:

1. **Temperature 0.** The judge is a classifier, not a writer; the same answer
   should score the same way every run (the same rule as the supervisor, Module 1).
2. **A tight rubric.** The system prompt tells it to compute
   `supported_claims / total_claims`, be conservative when a claim is not clearly
   backed, and ignore generic encouragement. A vague "rate the quality 1-10" judge
   is noise; a specific, mechanical rubric is repeatable.
3. **A gradient, not a pass/fail.** Grounding returns 0.0 to 1.0, and lists the
   unsupported claims. That gradient is what the iteration loop (Lesson 20) moves;
   a binary would hide partial progress. Faithfulness-style fractional grounding
   scores are the established way to evaluate retrieval-augmented answers (Es et
   al., 2024).

## How it is used

The same `groundingScore(state)` function is called two ways, one source of truth:

- **Locally**, opt-in via `RUN_GROUNDING=1 pnpm eval`, which prints a mean grounding
  score next to routing and citation. It is opt-in because it adds an LLM call per
  example.
- **In LangSmith**, as the `groundingEvaluator` wrapper passed to `evaluate()`
  (Lesson 19), so the dashboard tracks grounding over time.

Because the judge returns `unsupportedClaims`, a low score is also a list of the
exact sentences to investigate, which is how a grounding failure becomes a fix
rather than a mystery.

## A caution about judging with the same family of model

An LLM judge can share blind spots with the model it grades, and can be swayed by
fluent writing. Mitigations the coach uses: a narrow, mechanical rubric; a
temperature-0 setting; and structured output that forces the judge to *list*
unsupported claims rather than emit a vibe. Treat the grounding score as a strong
signal that pairs with the human read (`pnpm review`), not as an oracle.

### Build on the coach

Run `RUN_GROUNDING=1 pnpm eval` and find the example with the lowest grounding
score. Read its `unsupportedClaims`. Decide: is retrieval missing a document, or is
the composer adding a claim the sources do not support? That diagnosis is the
handoff into Lesson 20's iteration loop.

## References

Es, S., James, J., Espinosa-Anke, L., & Schockaert, S. (2024). RAGAs: Automated evaluation of retrieval augmented generation. In *Proceedings of the 18th Conference of the European Chapter of the Association for Computational Linguistics: System Demonstrations* (pp. 150–158). Association for Computational Linguistics.

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., Lin, Z., Li, Z., Li, D., Xing, E. P., Zhang, H., Gonzalez, J. E., & Stoica, I. (2023). Judging LLM-as-a-judge with MT-Bench and Chatbot Arena. In *Advances in Neural Information Processing Systems* (Vol. 36). Curran Associates.

---

Previous: [Lesson 17 · Deterministic evaluators](./17-deterministic-evaluators.md) · Next: **[Lesson 19 · Running evals in LangSmith](./19-running-evals-in-langsmith.md)** · [Course index](../README.md)
