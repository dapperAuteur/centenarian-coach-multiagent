# Module 2 · Lesson 10 — The embedding-consistency trap

> **Tag:** `course/lesson-10` · **Module 2: Specialist #1 (Nutrition)** · ~5 min

Here is a bug that does not throw, does not show up in a unit test, and quietly
ruins every answer: **seeding the knowledge base with one embedding model and
querying it with another.** This short lesson is about why that happens and how
the coach prevents it.

## Embeddings only mean something relative to their own model

A sentence embedding is a vector whose *only* meaning is its position relative to
other vectors produced by **the same model** (Reimers & Gurevych, 2019). Two
different models — even two that both output 768 numbers — place text in
different, incompatible spaces. Cosine similarity between a vector from model A and
a vector from model B is noise. So if you seed `coach_kb` with model A and embed
queries with model B, retrieval returns near-random documents, the specialist
grounds its answer in irrelevant snippets, and nothing errors — you just get
confidently wrong answers.

## One module for both seed-time and query-time

The coach routes every embedding — seeding *and* querying — through a single
factory, [`src/lib/embeddings.ts`](../../../src/lib/embeddings.ts):

```ts
const EMBEDDING_DIMS = 768;

export async function embed(text: string): Promise<number[]> {
  return activeProvider() === "ollama" ? ollamaEmbed(text) : geminiEmbed(text);
}
```

Both `scripts/seed-kb.mjs` and the specialists' `retrieve` nodes call `embed()`.
Because they share one code path, they cannot drift: whatever backend seeded the
corpus is the backend that embeds the query. The header comment says it plainly —
"switching providers means re-seeding the whole KB" — because the stored vectors
and the query vectors must live in the same space.

## Two guardrails worth copying

1. **Pin the dimensionality.** The column is `vector(768)`, and the Gemini call
   requests `outputDimensionality: 768` explicitly. The Ollama path *asserts* it:

   ```ts
   if (values.length !== EMBEDDING_DIMS) {
     throw new Error(`Ollama model returned ${values.length}-dim vectors; coach_kb expects 768...`);
   }
   ```

   A dimension mismatch fails loudly at insert/query time instead of silently
   corrupting search. (Google's Gemini embedding model supports configurable
   output dimensionality; the coach pins it to 768 — Google, 2025.)

2. **Make the provider an explicit, logged choice.** `COACH_EMBED_PROVIDER`
   selects the backend (`gemini` default, `ollama` local). The trap is switching it
   on a *seeded* database. The documented fix is a full re-seed
   (`pnpm kb:clear --all && pnpm kb:seed --fresh`), not a partial one — a half-Gemini,
   half-Ollama table is the worst of both.

## Why this lesson exists at all

It is tempting to treat "the embedding model" as an implementation detail you can
swap. It is not: it is part of your data's identity. Choosing a different embedding
model is choosing to rebuild your index. Naming that explicitly — and funnelling
seed and query through one function — turns a silent, expensive trap into a one-line
policy.

### Build on the coach

You seeded all four namespaces in Module 0 with the default (Gemini). As a thought
experiment, trace what would break if you set `COACH_EMBED_PROVIDER=ollama` and
restarted *without* re-seeding: which step returns garbage, and would any test
catch it? (Retrieval would return low-similarity, wrong-namespace-feeling results;
the grounding evaluator in Module 4 is the thing that would finally catch it — the
deterministic routing/citation tests would not.)

## References

Google. (2025). *Gemini API documentation: Embeddings*. https://ai.google.dev/gemini-api/docs/embeddings

Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence embeddings using Siamese BERT-networks. In *Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing and the 9th International Joint Conference on Natural Language Processing (EMNLP-IJCNLP)* (pp. 3982–3992). Association for Computational Linguistics. https://doi.org/10.18653/v1/D19-1410

---

Previous: [Lesson 9 — Per-agent retrieval namespacing](./09-per-agent-retrieval-namespacing.md) · Next: **[Lesson 11 — Building the first specialist subgraph](./11-building-the-nutrition-subgraph.md)** · [Course index](../README.md)
