// src/agents/corrective/retrieval.ts
// Retrieval for the Corrective Exercise specialist — scoped to the
// `corrective_kb` namespace. Each specialist owns its own namespace;
// isolation is enforced here, not by convention.

import { embed } from "@/lib/embeddings";
import { matchCoachKb } from "@/lib/pgvector";
import type { Citation } from "@/state";

// Retrieves on the sub-question and (when given) the user's original wording,
// merging by source. The supervisor's rewritten sub-question can drift toward
// generic phrasing; querying the original question too widens recall so the
// most on-point sources are not missed at a small k.
export async function retrieveCorrectiveKb(
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
    const matches = await matchCoachKb(embedding, "corrective_kb", k);
    for (const match of matches) {
      if (seen.has(match.source)) continue;
      seen.add(match.source);
      out.push({
        source: match.source,
        snippet: match.content,
        agent: "corrective" as const,
      });
    }
  }
  return out;
}
