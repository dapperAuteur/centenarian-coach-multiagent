// src/lib/pgvector.ts
// Cosine-similarity retrieval against the namespaced coach_kb store, via the
// match_coach_kb() SQL function (see src/db/migrations).

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export interface KbMatch {
  id: string;
  source: string;
  content: string;
  similarity: number;
}

/** Top-k coach_kb chunks for an embedding, scoped to one namespace. */
export async function matchCoachKb(
  embedding: number[],
  namespace: string,
  k: number,
): Promise<KbMatch[]> {
  // pgvector accepts a bracketed string literal cast to vector.
  const literal = `[${embedding.join(",")}]`;
  const db = getDb();
  const result: unknown = await db.execute(
    sql`SELECT id, source, content, similarity
        FROM match_coach_kb(${literal}::vector(768), ${namespace}, ${k})`,
  );
  // drizzle's neon-http driver returns either an array or { rows: [...] }.
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  return rows as KbMatch[];
}
