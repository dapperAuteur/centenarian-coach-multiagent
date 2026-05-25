// src/agents/corrective/retrieval.ts
// Retrieval for the Corrective Exercise specialist — scoped to the
// `corrective_kb` namespace. Each specialist owns its own namespace;
// isolation is enforced here, not by convention.

import { geminiEmbed } from "@/lib/embeddings";
import { matchCoachKb } from "@/lib/pgvector";
import type { Citation } from "@/state";

export async function retrieveCorrectiveKb(
  query: string,
  k = 5,
): Promise<Citation[]> {
  const embedding = await geminiEmbed(query);
  const matches = await matchCoachKb(embedding, "corrective_kb", k);
  return matches.map((match) => ({
    source: match.source,
    snippet: match.content,
    agent: "corrective" as const,
  }));
}
