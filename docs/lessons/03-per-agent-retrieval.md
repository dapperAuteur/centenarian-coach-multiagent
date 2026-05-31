# Lesson 3 — Per-agent retrieval: every specialist owns a namespace

In a single-agent RAG system there is one retriever over one corpus. In a
multi-agent system you have a choice, and the choice matters: do the specialists
share a retriever, or does each own its own? This lesson argues for the latter,
shows the namespaced-pgvector pattern this repo uses, and covers the trap that
sinks most retrieval setups.

## Why isolation, not a shared retriever

Suppose the coach had one `coach_kb` table and every specialist queried all of
it. Ask a workout question and the top-k results are a blend of training theory
*and* whatever recipe text happened to be near it in embedding space. The model
then grounds a training answer in nutrition documents. The answer is not wrong
because the model is bad — it is wrong because it was handed the wrong evidence.

Giving each specialist its own retrieval slice fixes this and buys more:

- **Relevance.** A workout query ranks only workout documents. No cross-domain
  noise in the top-k.
- **Independent tuning.** Each corpus can have its own chunk size, its own `k`,
  its own embedding refresh cadence. Nutrition facts are stable; a workout
  programming library might churn. Isolation lets them evolve separately.
- **Attribution.** Because a Nutrition finding can only cite `nutrition_kb`
  sources, the citation trail is honest by construction.
- **Blast radius.** Reindex or corrupt one namespace and the others are
  untouched.

The principle: **a specialist retrieves only from the corpus it is responsible
for.** That responsibility should be visible in the code, not assumed.

## The namespaced single-table pattern

You can isolate corpora with separate tables (`nutrition_kb`, `workout_kb`, …)
or with one table and a `namespace` column. This repo uses one namespaced
table — fewer migrations, one retrieval function, and adding a specialist is a
new namespace string rather than new DDL:

```sql
-- src/db/migrations (coach_kb)
CREATE TABLE coach_kb (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace  text NOT NULL,          -- 'nutrition_kb' | 'workout_kb' | 'recovery_kb' | 'corrective_kb'
  source     text NOT NULL,          -- citation label
  content    text NOT NULL,          -- the chunk (also the citation snippet)
  embedding  vector(768)
);
```

Retrieval is a SQL function that takes the namespace as a parameter, so the
filter happens in the database, before ranking:

```sql
CREATE FUNCTION match_coach_kb(query_embedding vector(768),
                               namespace_filter text,
                               match_count int DEFAULT 5)
RETURNS TABLE (id uuid, source text, content text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT id, source, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM coach_kb
  WHERE embedding IS NOT NULL AND namespace = namespace_filter
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

The `WHERE namespace = namespace_filter` is the whole isolation mechanism.
Cosine similarity (`<=>` is pgvector's cosine distance operator) ranks only the
rows that survive the filter.

## Each specialist's retrieval module

The isolation is then made concrete per specialist. The Nutrition specialist has
a retrieval module that *hard-codes* its namespace — it is not a parameter the
caller can get wrong:

```ts
// src/agents/nutrition/retrieval.ts
export async function retrieveNutritionKb(query: string, k = 5): Promise<Citation[]> {
  const embedding = await geminiEmbed(query);
  const matches = await matchCoachKb(embedding, "nutrition_kb", k);
  return matches.map((m) => ({
    source: m.source, snippet: m.content, agent: "nutrition" as const,
  }));
}
```

The Workout specialist has the mirror module bound to `"workout_kb"`. A
specialist *cannot* retrieve from the wrong namespace without editing its own
retrieval file — isolation enforced by module boundaries, not by remembering to
pass the right string.

Note the return type: `Citation[]`, already tagged with `agent: "nutrition"`.
Retrieval and attribution are the same step. Every chunk that comes back already
knows which specialist it belongs to, so the citation in the final answer is
correct without any later bookkeeping.

## The trap: embedding consistency

The one mistake that silently destroys a vector store: embedding the documents
with one model (or dimensionality) and the queries with another. Cosine
similarity between vectors from different models is meaningless — retrieval
still "works", it just returns near-random rows, and you will chase the symptom
for a long time.

This repo pins one embedding path for both seeding and querying — Gemini
`gemini-embedding-001` at 768 dimensions — and the `coach_kb.embedding` column
is `vector(768)` to match. Whatever you choose: pick one embedding model and one
dimensionality, use it for documents *and* queries, and encode the dimension in
the schema so a mismatch fails loudly instead of quietly.

## Build this yourself

Continue the support desk (Billing, Technical, Account).

**Exercise.** Give the desk a `support_kb` table with a `namespace` column and
a `match_support_kb` function, mirroring `coach_kb`. Seed three namespaces —
`billing_kb`, `technical_kb`, `account_kb` — with a handful of fixture
documents each. Then write three retrieval modules (`retrieveBillingKb`,
`retrieveTechnicalKb`, `retrieveAccountKb`), each hard-coding its namespace and
returning citation objects tagged with the agent. Verify that a billing query
never returns a technical document.

---

Next: **[Lesson 4 — State passing](./04-state-passing.md)** — sharing state across
nested subgraphs without specialists stomping on each other.
