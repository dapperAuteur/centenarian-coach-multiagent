# Module 2 · Lesson 9 — Per-agent retrieval namespacing

> **Tag:** `course/lesson-09` · **Module 2: Specialist #1 (Nutrition)** · ~6 min

This is the lesson the course is named for. Most multi-agent tutorials give every
agent the same retriever over the same documents. Fit T. Cent 3.0 does the
opposite: **each specialist owns its own retrieval namespace**, and that single
design choice is what makes the specialists actually specialized.

## One table, a namespace column

You might reach for one vector table per specialist. The coach uses a simpler
pattern that scales better: **one `coach_kb` table with a `namespace` column**
([`src/db/schema.ts`](../../../src/db/schema.ts)):

```ts
export const coachKb = pgTable("coach_kb", {
  id: uuid("id").primaryKey().defaultRandom(),
  namespace: text("namespace").notNull(), // 'nutrition_kb' | 'workout_kb' | ...
  source: text("source").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }),
  // ...
});
```

Retrieval-augmented generation grounds an answer in retrieved documents rather
than the model's parameters (Lewis et al., 2020); the `namespace` column decides
*which* documents are even eligible to be retrieved for a given specialist. One
table means one schema, one index, one seeding script — and isolation becomes a
`WHERE namespace = ...`, not a second database.

## The retrieval function is the boundary

Similarity search runs through `match_coach_kb`, a SQL function that does cosine
distance (`embedding <=> query`) **filtered by namespace**, wrapped in
[`src/lib/pgvector.ts`](../../../src/lib/pgvector.ts):

```ts
export async function matchCoachKb(embedding: number[], namespace: string, k: number) {
  const literal = `[${embedding.join(",")}]`;
  const result = await db.execute(
    sql`SELECT id, source, content, similarity
        FROM match_coach_kb(${literal}::vector(768), ${namespace}, ${k})`,
  );
  // ...
}
```

pgvector adds the `vector` type and similarity operators to Postgres (pgvector,
2025), and an approximate-nearest-neighbor index keeps top-k search fast as the
corpus grows (Malkov & Yashunin, 2020). The key line is the `namespace` argument:
nothing outside the requested namespace can come back.

Then each specialist hard-codes *its* namespace
([`src/agents/nutrition/retrieval.ts`](../../../src/agents/nutrition/retrieval.ts)):

```ts
export async function retrieveNutritionKb(query: string, k = 5): Promise<Citation[]> {
  const embedding = await embed(query);
  const matches = await matchCoachKb(embedding, "nutrition_kb", k);
  return matches.map((m) => ({ source: m.source, snippet: m.content, agent: "nutrition" }));
}
```

The Nutrition specialist *cannot* retrieve workout documents, because its
retrieval function only ever passes `"nutrition_kb"`. Isolation is enforced in
code, not by a prompt asking the model to "only use nutrition sources."

## Why this beats one shared retriever

A training question against a combined corpus returns a blurry mix of sleep
science, recipes, and program design, and the model grounds its answer in whatever
ranked highest. Namespacing removes the cross-talk at the source: a nutrition
query is scored only against nutrition documents, so the top-k is sharper, the
prompt is shorter, and the citation trail is honest — every snippet the Nutrition
finding cites genuinely came from `nutrition_kb`. Each namespace can also be
seeded, tuned, and evaluated independently (Module 4 evaluates them per-specialist).

### Build on the coach

Run `pnpm kb:status` and note the row counts per namespace. Then ask the coach a
nutrition question and open the LangSmith trace: find the `retrieve` step and
confirm every returned `source` is a nutrition document. Now imagine adding a fifth
namespace (`mindset_kb`): what is the *complete* list of changes? (A seed file, a
`retrieveMindsetKb` that passes the new namespace — and nothing in `pgvector.ts` or
the schema. That containment is the point, and Module 6 makes it concrete.)

## References

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In *Advances in Neural Information Processing Systems* (Vol. 33, pp. 9459–9474). Curran Associates.

Malkov, Y. A., & Yashunin, D. A. (2020). Efficient and robust approximate nearest neighbor search using hierarchical navigable small world graphs. *IEEE Transactions on Pattern Analysis and Machine Intelligence, 42*(4), 824–836. https://doi.org/10.1109/TPAMI.2018.2889473

pgvector. (2025). *pgvector: Open-source vector similarity search for Postgres* [Computer software]. GitHub. https://github.com/pgvector/pgvector

---

Previous: [Module 1 · Lesson 8 — Fan-out + temperature-0](../module-1-supervisor/08-fan-out-and-temperature-zero.md) · Next: **[Lesson 10 — The embedding-consistency trap](./10-embedding-consistency-trap.md)** · [Course index](../README.md)
