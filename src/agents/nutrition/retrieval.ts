// src/agents/nutrition/retrieval.ts
// Retrieval for the Nutrition specialist — scoped to the `nutrition_kb`
// namespace. Each specialist owns its own namespace; isolation is enforced
// here, not by convention.

import { embed } from "@/lib/embeddings";
import { matchCoachKb } from "@/lib/pgvector";
import type { Citation } from "@/state";

export async function retrieveNutritionKb(
  query: string,
  k = 5,
): Promise<Citation[]> {
  const embedding = await embed(query);
  const matches = await matchCoachKb(embedding, "nutrition_kb", k);
  return matches.map((match) => ({
    source: match.source,
    snippet: match.content,
    agent: "nutrition" as const,
  }));
}
