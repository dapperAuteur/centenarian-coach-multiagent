// src/agents/workout/retrieval.ts
// Retrieval for the Workout specialist — scoped to the `workout_kb` namespace.

import { geminiEmbed } from "@/lib/embeddings";
import { matchCoachKb } from "@/lib/pgvector";
import type { Citation } from "@/state";

export async function retrieveWorkoutKb(
  query: string,
  k = 5,
): Promise<Citation[]> {
  const embedding = await geminiEmbed(query);
  const matches = await matchCoachKb(embedding, "workout_kb", k);
  return matches.map((match) => ({
    source: match.source,
    snippet: match.content,
    agent: "workout" as const,
  }));
}
