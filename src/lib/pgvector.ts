// src/lib/pgvector.ts
// Cosine-similarity retrieval against the namespaced coach_kb store, via the
// match_coach_kb() SQL function (see src/db/migrations).

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getCorpusMode, type CorpusMode } from "@/lib/settings";

export interface KbMatch {
  id: string;
  source: string;
  content: string;
  similarity: number;
}

/**
 * Top-k coach_kb chunks for an embedding, scoped to one namespace and the
 * active corpus visibility. `visibility` defaults to the dashboard's
 * corpus_mode (public / private / both); pass it explicitly to override (e.g.
 * 'both' in evals). 'both' applies no visibility filter.
 */
export async function matchCoachKb(
  embedding: number[],
  namespace: string,
  k: number,
  visibility?: CorpusMode,
): Promise<KbMatch[]> {
  const mode = visibility ?? (await getCorpusMode());
  // pgvector accepts a bracketed string literal cast to vector.
  const literal = `[${embedding.join(",")}]`;
  const db = getDb();
  const result: unknown = await db.execute(
    sql`SELECT id, source, content, similarity
        FROM match_coach_kb(${literal}::vector(768), ${namespace}, ${k}, ${mode})`,
  );
  // drizzle's neon-http driver returns either an array or { rows: [...] }.
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  return rows as KbMatch[];
}
