// src/agents/nutrition/retrieval.ts
// Retrieval for the Nutrition specialist — scoped to the `nutrition_kb`
// namespace. Each specialist owns its own namespace; isolation is enforced
// here, not by convention.

import { embed } from "@/lib/embeddings";
import { matchCoachKb } from "@/lib/pgvector";
import type { Citation } from "@/state";

// Retrieves on the sub-question and (when given) the user's original wording,
// merging by chunk. The supervisor's rewritten sub-question can drift toward
// generic phrasing; querying the original question too widens recall so the
// most on-point sources are not missed at a small k.
export async function retrieveNutritionKb(
  query: string,
  k = 8,
  alsoQuery?: string,
): Promise<Citation[]> {
  const queries =
    alsoQuery && alsoQuery.trim() && alsoQuery !== query
      ? [query, alsoQuery]
      : [query];
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const q of queries) {
    const embedding = await embed(q);
    const matches = await matchCoachKb(embedding, "nutrition_kb", k);
    for (const match of matches) {
      // Dedupe by CHUNK id, not by `source`.
      //
      // `source` is a page-level label, and pages hold ~3.5 chunks. Deduping on
      // it kept only the highest-ranked chunk per page and silently discarded
      // its siblings, which is where the numbers live.
      //
      // Measured 2026-08-11 on case cx-easy-003 ("outline a beginner 3-day
      // full-body strength program"): the retrieved page
      // `NASM CPT · CPT7_Study-Guide_Section5 · p. 17` reached the composer as
      // its first chunk, a conceptual passage about progressing stabilization
      // to strength to power. The acute-variables table on that same page
      // (~12-20 reps, ~1-3 sets, ~50-70% 1RM) was the second chunk and was
      // dropped here. The answer the question needed was retrieved and then
      // thrown away before the model saw it.
      //
      // Across the 9 failing cases of the actionability regression, retrieved
      // snippets carried 65 concrete specifics and specialist findings kept 15.
      // See centenarian-coach-multiagent/plans/11-actionability-regression.md.
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      out.push({
        source: match.source,
        snippet: match.content,
        agent: "nutrition" as const,
      });
    }
  }
  return out;
}
