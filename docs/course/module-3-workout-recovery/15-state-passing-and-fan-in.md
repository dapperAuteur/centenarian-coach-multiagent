# Module 3 · Lesson 15 · State passing and fan-in

> **Tag:** `course/lesson-15` · **Module 3: Specialists #2 + #3** · ~6 min

The specialists fan out and run in parallel. Something has to collect their
findings without losing any, and one node has to weave them into a single answer.
This lesson is the fan-in: the merge reducer that lets parallel writes coexist,
and the synthesizer that reads them all.

## The merge reducer lets parallel writes coexist

The top-level state's `findings` channel has an object-merge reducer
([`src/state.ts`](../../../src/state.ts)):

```ts
findings: Annotation<FindingsMap>({
  reducer: (prev, next) => ({ ...prev, ...next }),
  default: () => ({}),
}),
```

A channel reducer tells LangGraph how to combine writes to the same channel from
the same superstep (LangChain, 2025). Without one, two specialists writing
`findings` in the same parallel step would conflict and the framework would
reject the concurrent update. With the spread-merge reducer, Workout writing
`{ workout: ... }` and Recovery writing `{ recovery: ... }` merge into
`{ workout: ..., recovery: ... }`. Each adapter writes only its own key (Lesson
12), so the merge never overwrites: the keys are disjoint by construction.

This is the other half of the isolation story. Lesson 12 showed a specialist
cannot read another's findings. The reducer shows a specialist cannot clobber
another's findings either. Together they make parallel fan-out safe.

## The synthesizer is the one node that reads everything

After the specialists fan in, the synthesizer
([`src/synthesizer/synthesize.ts`](../../../src/synthesizer/synthesize.ts)) runs.
It is the only node in the whole graph that reads the full `findings` map:

```ts
const findings: SpecialistFinding[] = [];
for (const agent of ["nutrition", "workout", "recovery", "corrective"] as const) {
  const finding = state.findings[agent];
  if (finding) findings.push(finding);
}
const citations: Citation[] = findings.flatMap((f) => f.citations);
```

It gathers whichever findings exist, concatenates their citations, and asks a
model to weave a single answer that connects the specialists' advice rather than
listing it. The system prompt forbids inventing facts the specialists did not
provide, and it does not write its own citation list: the citations are attached
from the findings, so every source in the final answer traces back to a specialist
that actually retrieved it. That is the citation-grounding discipline closing at
the top of the graph (Lewis et al., 2020).

If no specialist ran (an off-topic question that routed to nobody), the
synthesizer returns a graceful "no specialist was available" answer instead of
failing. The graph always terminates with a `finalAnswer`.

### Build on the coach

Ask a three-domain question ("I am 70 and want to stay strong for decades, what
should my diet, training, and recovery look like?"). In the trace, watch three
findings merge into the `findings` channel, then the synthesizer read all three.
Read the final answer and check two things: every paragraph traces to a cited
source, and the answer connects the domains (for example, eating to support the
training load) rather than printing three separate mini-answers. Module 4 turns
both of those checks into automated evaluators.

## References

LangChain. (2025). *LangGraph documentation: State channels and reducers*. https://langchain-ai.github.io/langgraphjs/

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In *Advances in Neural Information Processing Systems* (Vol. 33, pp. 9459–9474). Curran Associates.

---

Previous: [Lesson 14 · Adding Recovery + isolation](./14-adding-recovery-and-isolation.md) · **End of Module 3** · Next: *Module 4 · LangSmith evaluation* · [Course index](../README.md)
