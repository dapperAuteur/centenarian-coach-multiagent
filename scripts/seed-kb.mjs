// scripts/seed-kb.mjs
// Seeds the coach_kb table from kb-fixtures/*.json. Each file's basename is the
// namespace (e.g. nutrition_kb.json -> namespace 'nutrition_kb').
//
// Prerequisite: apply the migration in src/db/migrations first.
// Run:  pnpm kb:seed     (= node --env-file=.env.local scripts/seed-kb.mjs)
// Requires: STORAGE_DATABASE_URL (or DATABASE_URL), GOOGLE_GEMINI_API_KEY
//
// Idempotent: deletes a namespace's rows before re-inserting them.

import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;
const FIXTURES_DIR = resolve(process.cwd(), "kb-fixtures");

async function embed(text, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMS,
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini embedding failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const values = data.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding returned an empty vector");
  }
  return values;
}

async function main() {
  const dbUrl = process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL;
  const geminiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
  const missing = [];
  if (!dbUrl) missing.push("STORAGE_DATABASE_URL (or DATABASE_URL)");
  if (!geminiKey) missing.push("GEMINI_API_KEY (or GOOGLE_GEMINI_API_KEY)");
  if (missing.length > 0) {
    throw new Error(
      `Missing env var(s): ${missing.join(", ")}. ` +
        "They must be present in .env.local (run with: pnpm kb:seed).",
    );
  }

  const sql = neon(dbUrl);
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error(`No *.json fixtures found in ${FIXTURES_DIR}`);
  }

  for (const file of files) {
    const namespace = basename(file, ".json");
    const docs = JSON.parse(readFileSync(resolve(FIXTURES_DIR, file), "utf8"));
    console.log(`\n${namespace}: clearing and seeding ${docs.length} docs...`);

    await sql`DELETE FROM coach_kb WHERE namespace = ${namespace}`;

    for (const doc of docs) {
      const embedding = await embed(doc.content, geminiKey);
      const literal = `[${embedding.join(",")}]`;
      await sql`
        INSERT INTO coach_kb (namespace, source, content, embedding)
        VALUES (${namespace}, ${doc.source}, ${doc.content}, ${literal}::vector(768))
      `;
      console.log(`  inserted: ${doc.source}`);
    }
  }

  console.log("\nDone seeding coach_kb.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
