# Module 0 · Lesson 4 · First-run smoke test

> **Tag:** `course/lesson-04` · **Module 0: Setup + scope** · ~5 min

The promise of Module 0: the coach runs **before** you learn how it works. This
lesson seeds a corpus, asks one question, and reads the answer plus its trace. If
this works, the rest of the course is dissecting something you have already seen
run.

## 1. Seed a corpus

Each specialist retrieves from its own namespace in the `coach_kb` table, so the
table needs documents before retrieval returns anything. Drop a corpus into
`kb-fixtures/` following the shape documented in
[`kb-fixtures/README.md`](../../../kb-fixtures/README.md) (the course provides
example nutrition / workout / recovery corpora; you can also bring your own), then:

```bash
pnpm kb:seed      # embeds each document and inserts it into coach_kb, by namespace
pnpm kb:status    # prints how many rows landed in each namespace
```

`pnpm kb:seed` ([`scripts/seed-kb.mjs`](../../../scripts/seed-kb.mjs)) embeds every
document with the same model the coach uses at query time and writes a
768-dimension vector per row. That "same model at seed and query" rule is the
embedding-consistency trap you will meet properly in Module 2 · a sentence embedding
only means something relative to other vectors from the *same* model (Reimers &
Gurevych, 2019). For now, just confirm `pnpm kb:status` shows non-empty namespaces.

## 2. Ask a question

Start the dev server and open the coach, or hit the API directly:

```bash
pnpm dev
# then open http://localhost:3000/coach and ask:
#   "How much protein should a 70-year-old eat to preserve muscle?"
```

The route handler [`src/app/api/coach/query/route.ts`](../../../src/app/api/coach/query/route.ts)
streams NDJSON events as the graph runs. You will see them arrive in order:

1. `session`, a session id.
2. `routing`, the supervisor's decision (this question → **nutrition**), with a
   rationale.
3. `finding`, the nutrition specialist's answer, **with citations** to the
   snippets it retrieved.
4. `answer`, the synthesizer's final, woven answer plus the combined citations.

That ordering is not luck; it is enforced by the graph's structure, which is the
subject of Module 1. The citations are the grounding discipline from Lesson 1 made
concrete: the answer rests on retrieved documents, not the model's memory (Lewis et
al., 2020).

## 3. Read the trace

If you set `LANGSMITH_API_KEY`, every query writes a LangSmith trace
(LangChain, 2025). The `done` event carries a `langsmithRunId`; open that run and
you will see the tree: the supervisor node, the nutrition specialist as a nested
subgraph (retrieve → assess → compose), and the synthesizer at the end. Tracing is
how you debug a multi-agent system that "fails quietly", a wrong route still
produces a fluent answer, and the trace is where you see *why* (LangChain, 2025).
Observability is wired into the artifact from the first run, not added later.

If `LANGSMITH_API_KEY` is unset, the app still runs, tracing is fail-soft, but you
will not have a trace to open. Set it now; you will use traces in every module.

## You now have a running coach

A seeded corpus, a routed-and-cited answer, and a trace. That is the whole system
in miniature. Module 1 starts where this lesson glossed over: *how does the
supervisor decide where to route, and why is the ordering guaranteed?*

### Try it

Ask a cross-domain question, "I slept five hours; should I train legs today?", and watch the `routing` event fan out to **two** specialists. Note which two, and
whether the final answer connects their advice or just lists it. You will make that
behavior measurable in Module 4.

## References

LangChain. (2025). *LangSmith documentation: Observability and tracing*. https://docs.langchain.com/langsmith

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In *Advances in Neural Information Processing Systems* (Vol. 33, pp. 9459–9474). Curran Associates.

Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence embeddings using Siamese BERT-networks. In *Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing and the 9th International Joint Conference on Natural Language Processing (EMNLP-IJCNLP)* (pp. 3982–3992). Association for Computational Linguistics. https://doi.org/10.18653/v1/D19-1410

---

Previous: [Lesson 3 · Getting set up (Python)](./03-getting-set-up-python.md) · **End of Module 0** · Next: *Module 1 · The supervisor (in progress)* · [Course index](../README.md)
