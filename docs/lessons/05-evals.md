# Lesson 5 · Evals: catching the failures you actually care about

> The eval **dataset and runner** now ship in this repo: `evals/dataset.json`,
> `evals/rubric.ts`, and `pnpm eval`. This lesson walks through how they work.

A multi-agent system fails quietly. A misrouted question still produces a
confident, fluent answer. A paragraph with no supporting citation looks exactly
like one that has support. Nothing throws. You only find out when a user does.
Evals are how you turn those silent failures into a number you can watch.

## What to evaluate

For a supervisor-and-specialists system, three things fail independently, so
evaluate them independently:

1. **Routing accuracy.** Did the supervisor consult the right specialists? A
   pure-nutrition question that also wakes the Workout specialist wastes budget;
   a cross-domain question routed to one specialist gives a half answer.
2. **Citation coverage.** Does every paragraph of the final answer rest on at
   least one citation? Does each specialist finding carry the `≥ 1` citations
   the design promises?
3. **Grounding.** Is the answer actually supported by the retrieved sources, or
   did the model add plausible facts that no source backs?

Routing and citation coverage are checkable with plain code. Grounding needs a
judge, usually an LLM scoring the answer against its sources.

## The dataset

An eval dataset is a set of examples: an input plus whatever you need to grade
the output. The set in `evals/dataset.json` is 20 examples spanning pure-domain
questions, two-domain questions, and three-domain questions.

```jsonc
// evals/dataset.json  (shape)
[
  { "id": "n1", "question": "How much protein should a 70-year-old eat?", "expectedAgents": ["nutrition"] },
  { "id": "wr1", "question": "I slept five hours. Should I still train legs today?", "expectedAgents": ["workout", "recovery"] }
]
```

Keep `expectedAgents` deliberately small and certain. If you cannot confidently
say how a question *should* route, it is a bad eval example, drop it.

## Evaluators

An evaluator takes a run's output and returns a score. The deterministic ones
are simple functions:

```ts
// routing accuracy, exact-set match
function routingScore(output: CoachState, example: { expectedAgents: Agent[] }) {
  const got = [...(output.routing?.agents ?? [])].sort();
  const want = [...example.expectedAgents].sort();
  const correct = got.length === want.length && got.every((a, i) => a === want[i]);
  return { key: "routing_correct", score: correct ? 1 : 0 };
}

// citation coverage, every finding must carry citations
function citationScore(output: CoachState) {
  const findings = Object.values(output.findings);
  const ok = findings.length > 0 && findings.every((f) => f.citations.length > 0);
  return { key: "citations_present", score: ok ? 1 : 0 };
}
```

The grounding evaluator is LLM-as-judge: give a model the answer and the
specialist findings (which carry the source snippets) and ask it to score, 0–1,
how well every claim is supported. Pin that judge at `temperature: 0` and give
it a tight rubric, "1 only if every sentence is traceable to a snippet."

## Running it

In this repo the runner is a Vitest test, `tests/coach.eval.test.ts`, run with
`pnpm eval`. It invokes the real coach graph over every example in
`evals/dataset.json`, applies the evaluators, prints a per-question and summary
table, and fails if mean routing accuracy or citation coverage drops below its
threshold:

```ts
for (const example of dataset) {
  const state = await coachGraph.invoke({
    sessionId: `eval-${example.id}`,
    userQuery: example.question,
  });
  routingHits += routingScore(state, example).score;
  citationHits += citationScore(state).score;
}
expect(routingHits / dataset.length).toBeGreaterThanOrEqual(0.8);
```

It is opt-in (the run makes ~20 graph invocations, each several LLM calls), so
it stays out of the fast default `pnpm test`. The rubric functions themselves
have pure unit tests that DO run every time.

A pull request that drops routing accuracy should fail this gate, not surprise
a user. That regression gate is the entire point: evals you run once and admire
are worth very little.

For hosted, dashboarded evals, LangChain's `evaluate()` from
`langsmith/evaluation` runs the same shape against a dataset registered in
LangSmith. The local runner here keeps the gate dependency-free and CI-cheap.

## Reading the results

Watch the scores as a set, not a single number. Low **routing** with high
**grounding** means the specialists are good but the supervisor sends them the
wrong questions, fix the supervisor prompt or schema. High routing with low
**grounding** means retrieval or the composer is the problem, the right
specialist is answering, just not from its sources. Decomposed scores tell you
*where* to look; a single blended "quality" score does not.

## The manual companion

Alongside the automated eval, `scripts/review.mjs` (`pnpm review`) runs ten
questions through the live system and prints routing, findings, and the
synthesized answer for each, for a human to read. The eval gives you a number;
the review lets you actually read the answers. Use both: the eval catches
regressions, the review catches "technically passed but reads badly."

## Build this yourself

Continue the support desk (Billing, Technical, Account).

**Exercise.** Write five eval examples for the desk: two pure-domain, two
cross-domain, and one edge case (a question no specialist should handle). For
each, write down `expectedAgents`. Then implement the `routingScore` and
`citationScore` evaluators for the desk and run them over your five examples by
hand. Which example is hardest to assign an expected route to, and what does
that tell you about the question?

---

Back to **[the lessons index](./README.md)** · or the
**[project README](../../README.md)**.
