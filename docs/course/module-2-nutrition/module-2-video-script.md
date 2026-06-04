# Video scripts · Module 2 (Specialist #1: Nutrition)

> Verbatim narration + shot-by-shot screen-recording directions for lessons 9 to 12.
> Audience note: first-time viewers; gloss each term on first use. Record against the
> lesson's `course/lesson-NN` tag. Pace ~140 wpm. `[cite: ...]` = on-screen citation
> matching that lesson's `## References`. No em-dashes in any on-screen text.

---

## Lesson m2-l9 · Per-agent retrieval namespacing · tag `course/lesson-09` · ~6 min

**NARRATION (verbatim)**

> This is the lesson the course is named for, so let me define the words first. A
> *corpus* is just the set of documents a specialist can search. To search by
> meaning, we turn each document into an *embedding*, which is a list of numbers that
> captures what the text is about. Similar meanings get similar numbers. Storing and
> searching those numbers in Postgres is what the *pgvector* extension adds.
> [cite: pgvector, 2025] And retrieval-augmented generation, RAG, just means we fetch
> relevant documents and let the model answer from them instead of from memory.
> [cite: Lewis et al., 2020]
>
> Here is the design choice that makes the specialists actually specialized. Instead
> of a separate database per specialist, the coach uses one table, `coach_kb`, with a
> *namespace* column. A namespace is just a label: nutrition_kb, workout_kb, and so
> on. Search is filtered by that label, so a nutrition search only ever sees
> nutrition documents.
>
> Look at how it is enforced. The search runs through a SQL function,
> `match_coach_kb`, that takes an embedding and a namespace and returns the closest
> matches in that namespace only. Then each specialist hard-codes its own namespace.
> In `retrieval.ts`, the nutrition retriever always passes "nutrition_kb." It is
> physically incapable of returning a workout document. Isolation is in the code, not
> in a prompt politely asking the model to stay in its lane.
>
> Why this beats one shared pile. A training question against a combined corpus comes
> back as a blurry mix of recipes and sleep science, and the model grounds on
> whatever ranked highest. Namespacing removes that cross-talk at the source: sharper
> results, shorter prompts, and an honest citation trail, because every cited snippet
> genuinely came from that specialist's namespace. Next, the trap that quietly ruins
> all of this if you get it wrong.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-09`.
1. Open `src/db/schema.ts`; zoom on the `coachKb` table, highlight the `namespace`
   and `embedding vector(768)` columns.
2. Open `src/db/migrations/0000_*.sql`; highlight the `match_coach_kb(query_embedding,
   namespace_filter, match_count)` signature; show the `<=>` cosine operator.
3. Open `src/agents/nutrition/retrieval.ts`; highlight the literal `"nutrition_kb"`
   passed to `matchCoachKb`.
4. Terminal: `pnpm kb:status`; show non-empty counts per namespace.
5. In the LangSmith trace of a nutrition question, expand the `retrieve` node; show
   every returned `source` is a nutrition document.

---

## Lesson m2-l10 · The embedding-consistency trap · tag `course/lesson-10` · ~5 min

**NARRATION (verbatim)**

> Here is a bug that does not crash, does not fail a test, and quietly ruins every
> answer: seeding your knowledge base with one embedding model and searching it with
> a different one.
>
> Remember, an embedding is only meaningful relative to other embeddings from the
> *same* model. [cite: Reimers & Gurevych, 2019] Two different models, even if both
> output 768 numbers, place text in different spaces. Comparing a number from model A
> to a number from model B is noise. So if you seed with model A and query with model
> B, search returns near-random documents, the specialist grounds on junk, and
> nothing errors. You just get confident, wrong answers.
>
> The coach prevents this by routing every embedding, both seeding and querying,
> through one function in `embeddings.ts`. Because seed time and query time share one
> code path, they cannot drift. Whatever embedded the documents is what embeds the
> question.
>
> Two guardrails worth copying. First, pin the size. The column is vector of 768, and
> the code requests exactly 768 dimensions, and the local path even throws if a model
> returns the wrong size. A mismatch fails loudly instead of corrupting search
> silently. [cite: Google, 2025] Second, treat the embedding model as part of your
> data's identity, not a swappable detail. If you change it, you re-seed the whole
> knowledge base. The documented fix is a full clear-and-reseed, never a half-and-half
> table.
>
> So the rule for the whole module: seed and query must live in the same embedding
> space. Next, we actually build the nutrition specialist.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-10`.
1. Slide: two different "spaces" with the same query landing in different places;
   label "model A" and "model B," show mismatched nearest neighbors.
2. Open `src/lib/embeddings.ts`; highlight the single `embed()` entry point and the
   `EMBEDDING_DIMS = 768` constant.
3. Highlight the Ollama dimension-check that throws on the wrong size.
4. Show the header comment's re-seed instruction (`pnpm kb:clear` then `pnpm kb:seed`).

---

## Lesson m2-l11 · Building the first specialist subgraph (Nutrition) · tag `course/lesson-11` · ~7 min

**NARRATION (verbatim)**

> A specialist is not a prompt. It is a small graph of its own, and once you build
> one, the rest are copies. Let me build nutrition.
>
> Open `nutrition/subgraph.ts`. It is a four-step graph: retrieve, assess, then either
> tools or straight to compose, then end. A *subgraph* is just a graph nested inside
> the bigger one, so each specialist's logic stays self-contained. [cite: LangChain,
> 2025]
>
> The retrieve step pulls documents from the nutrition namespace, the one from lesson
> nine. The assess step is interesting: it is a structured-output call that decides
> whether a tool is needed. A *tool* here is a plain function the model can call, like
> a calorie calculator. Deciding whether to act, then acting, is a common pattern
> called ReAct. [cite: Yao et al., 2023] If the question has enough data, like age,
> weight, and activity level, the calorie tool runs. If not, it skips straight to
> compose.
>
> The compose step writes the answer, and this is where grounding becomes mechanical:
> it is handed only the retrieved sources and any tool results, and told to write from
> them. So the answer is built out of the snippets, and those same snippets ride along
> as the citations.
>
> Last piece: the adapter node, `nutritionNode`. The big graph does not know about the
> nutrition subgraph's private state, so the adapter runs the subgraph, packages the
> result as a finding with its citations, and writes it into one slot of the shared
> state: findings dot nutrition. It writes only its own slot. Why it can only write
> its own, and cannot read anyone else's, is the next lesson, and it is enforced by
> the type system, not by discipline.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-11`.
1. Open `src/agents/nutrition/subgraph.ts`; trace the graph build:
   `retrieve -> assess -> (tools | compose) -> compose -> END`; draw the shape.
2. Highlight `retrieveNode` (calls `retrieveNutritionKb`), `assessNode`
   (`withStructuredOutput(AssessSchema, { name: "assess_tools" })`), and the
   conditional edge `needsCalorieTool ? "tools" : "compose"`.
3. Highlight `composeNode`'s prompt: the `Retrieved sources` block fed to the model.
4. Highlight the adapter `nutritionNode` returning `{ findings: { nutrition: ... } }`.
5. In a LangSmith trace, ask a nutrition question without calorie data (no `tools`
   node), then one with full data (the `tools` node fires).

---

## Lesson m2-l12 · The type-enforced "can't read other specialists' findings" trick · tag `course/lesson-12` · ~4 min

**NARRATION (verbatim)**

> Most systems keep specialists from reading each other's work with a prompt, "please
> ignore the other agents," and hope. The coach makes it impossible instead, using
> the type system.
>
> Look at the nutrition subgraph's state definition. It has the sub-question, the
> citations, the tool calls, a draft. It does *not* have a findings field. So inside
> the nutrition specialist, there is no such thing as another specialist's findings.
> It is not empty, it does not exist, and the code would not even compile if you tried
> to read it. This is the principle of least privilege: give a component access only
> to what it needs. [cite: Saltzer & Schroeder, 1975] Nutrition needs its question and
> its sources. It does not need anyone else's answer, so it cannot have it.
>
> The shared findings map does exist, but one level up, with a *reducer*, which is
> just a rule for combining writes. The nutrition adapter writes only its own key. When
> specialists run in parallel, each writes a different key, and the reducer merges them
> without collision. So a specialist cannot read another's findings, and cannot
> clobber them either.
>
> Why type-enforced beats prompt-enforced: a prompt is a request the model can ignore,
> and you find the leak in production. A missing field is a compile error, the leak is
> impossible to write. For a health assistant where attribution is the whole point,
> impossible to write is the standard you want. Next module, we add the other two
> specialists, fast.

**SCREEN-RECORDING (shot list)**

0. `git checkout course/lesson-12`.
1. Open `src/agents/nutrition/subgraph.ts`; zoom on `NutritionAnnotation`; point out
   there is no `findings` channel.
2. In a scratch edit, type `state.findings` inside `composeNode`; show TypeScript's
   red error ("not on `NutritionState`"); revert.
3. Open `src/state.ts`; highlight the `findings` object-merge reducer and the adapter
   writing only `{ nutrition: ... }`.

---

## Module 2 runtime check

l9 6 + l10 5 + l11 7 + l12 4 = ~22 min.
