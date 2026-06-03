# Module 6 · Lesson 25 · How to add a new specialist (worked with Corrective)

> **Tag:** `course/lesson-25` · **Module 6: Extension launching pad** · ~5 min

This is the lesson the whole course was building toward: not another feature, but
the **shape of adding one**. Fit T. Cent 3.0 ships a fourth specialist, Corrective
Exercise, that you have not studied yet. We use it as the worked example, because
adding it touched exactly six places and nothing else. That containment is the
payoff of every isolation decision in Modules 1 to 3.

## The six-point checklist

To add the Corrective specialist, someone made these changes and no others:

1. **A namespace + corpus.** Documents seeded into `corrective_kb` in `coach_kb`
   (Module 2). One namespace, one seed source.
2. **A retrieval module.**
   [`src/agents/corrective/retrieval.ts`](../../../src/agents/corrective/retrieval.ts):
   `retrieveCorrectiveKb` passes `"corrective_kb"` to `matchCoachKb`. One word
   different from Nutrition's.
3. **A subgraph.**
   [`src/agents/corrective/subgraph.ts`](../../../src/agents/corrective/subgraph.ts):
   its own `CorrectiveAnnotation` (with no `findings` channel, so isolation is free,
   Module 2), and an adapter `correctiveNode` that writes only `findings.corrective`.
4. **The type union.** Add `"corrective"` to `Agent` and a slot to `FindingsMap` in
   [`src/state.ts`](../../../src/state.ts).
5. **The routing schema + prompt.** Add `"corrective"` to `AgentEnum` in
   [`routing.schema.ts`](../../../src/agents/supervisor/routing.schema.ts) and one
   line describing its domain to the supervisor's system prompt.
6. **Register it in the graph.**
   [`src/graph.ts`](../../../src/graph.ts): `addNode("corrective", correctiveNode)`,
   add it to the fan-out targets, and add the edge to `synthesize`.

That is the entire diff. The synthesizer already loops over all agents, so it
picked up Corrective with no change; the merge reducer already handles a new
findings key; the topology test already asserts ordering for any specialist.

## A specialist can be simpler than the template

Corrective is the simplest specialist on purpose: its graph is just
`retrieve -> compose -> END`, with no `assess` and no tools, because the v1
corrective agent has no calculator or wearable mock to call. That shows the
template flexes: a specialist needs a namespace and a compose step; tools and an
assess node are optional. Start a new specialist at this minimum and add an assess
or tools node only when it actually has a tool.

## Why this is a launching pad, not a wall

Every earlier module removed a reason adding a specialist would be hard. Per-agent
namespacing (Module 2) meant the new corpus does not disturb the others.
Type-enforced isolation (Module 2) meant the new specialist cannot leak or be
leaked into. The merge reducer (Module 3) meant parallel fan-out absorbs it. The
eval suite (Module 4) meant you can measure whether it routes correctly (the `c1`
example was added for exactly this specialist). The system was designed to be
extended, and this checklist is the proof.

### Build on the coach

Trace the Corrective specialist end to end: ask "my right shoulder rounds forward
when I press overhead, how do I fix it?", and in the LangSmith trace watch the
supervisor route to `corrective` and the `retrieve -> compose` subgraph run. Then
open the six files above and confirm the change really is contained to them. That
is the map you will follow to add your own.

## References

LangChain. (2025). *LangGraph documentation: Subgraphs and multi-agent systems*. https://langchain-ai.github.io/langgraphjs/

Saltzer, J. H., & Schroeder, M. D. (1975). The protection of information in computer systems. *Proceedings of the IEEE, 63*(9), 1278–1308. https://doi.org/10.1109/PROC.1975.9939

---

Previous: [Module 5 · Lesson 24 · Cost and latency dashboards](../module-5-deployment/24-cost-and-latency-dashboards.md) · Next: **[Lesson 26 · Five extensions with file paths](./26-extensions-with-file-paths.md)** · [Course index](../README.md)
