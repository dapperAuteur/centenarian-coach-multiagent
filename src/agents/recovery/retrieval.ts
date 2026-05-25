// src/agents/recovery/retrieval.ts
// Retrieval for the Recovery specialist — scoped to the `recovery_kb`
// namespace. Each specialist owns its own namespace.

import { embed } from "@/lib/embeddings";
import { matchCoachKb } from "@/lib/pgvector";
import type { Citation } from "@/state";

export async function retrieveRecoveryKb(
  query: string,
  k = 5,
): Promise<Citation[]> {
  const embedding = await embed(query);
  const matches = await matchCoachKb(embedding, "recovery_kb", k);
  return matches.map((match) => ({
    source: match.source,
    snippet: match.content,
    agent: "recovery" as const,
  }));
}
