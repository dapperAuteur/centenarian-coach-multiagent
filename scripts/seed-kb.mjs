// scripts/seed-kb.mjs
// Seeds the coach_kb table from kb-fixtures/. Each *.json file's basename is
// the namespace (e.g. nutrition_kb.json -> namespace 'nutrition_kb').
// Two source dirs:
//   - kb-fixtures/*.json          public; tracked by git (currently empty).
//   - kb-fixtures/private/*.json  gitignored; the operator's own corpus
//                                 (e.g. NASM PDFs via `pnpm kb:ingest`).
// When the same namespace exists in both, the private file wins.
//
// Prerequisite: apply the migration in src/db/migrations first.
// Run:  pnpm kb:seed     (= node --env-file=.env.local scripts/seed-kb.mjs)
// Requires: STORAGE_DATABASE_URL (or DATABASE_URL), GOOGLE_GEMINI_API_KEY.
//
// Idempotent: deletes a namespace's rows before re-inserting them. Embeds
// in batches of EMBED_BATCH (100) via Gemini's batchEmbedContents — keeps a
// large corpus to a handful of API calls.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;
const EMBED_BATCH = 100;

const FIXTURES_DIR = resolve(process.cwd(), "kb-fixtures");
const PRIVATE_DIR = resolve(FIXTURES_DIR, "private");

// C0 control chars Postgres rejects in `text` columns (most importantly
// the NUL byte 0x00, which pdfjs sometimes emits from quirky embedded
// fonts). Keep TAB, LF, CR.
const C0_NOISE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const sanitize = (s) => (typeof s === "string" ? s.replace(C0_NOISE, "") : s);

/** Discover all fixture files. Private overrides public for a given
 * namespace. Returns Map<namespace, { path, source }>. */
function discoverFixtures() {
  const map = new Map();
  if (existsSync(FIXTURES_DIR)) {
    for (const file of readdirSync(FIXTURES_DIR)) {
      if (!file.endsWith(".json")) continue;
      map.set(basename(file, ".json"), {
        path: join(FIXTURES_DIR, file),
        source: "public",
      });
    }
  }
  if (existsSync(PRIVATE_DIR)) {
    for (const file of readdirSync(PRIVATE_DIR)) {
      if (!file.endsWith(".json")) continue;
      map.set(basename(file, ".json"), {
        path: join(PRIVATE_DIR, file),
        source: "private",
      });
    }
  }
  return map;
}

/** Embed up to ~100 inputs in one Gemini API call. */
async function embedBatch(texts, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;
  const requests = texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMS,
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    throw new Error(
      `Gemini batch embedding failed (${res.status}): ${await res.text()}`,
    );
  }
  const data = await res.json();
  const embeddings = data.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error(
      `Gemini batch embedding returned ${embeddings?.length} embeddings for ${texts.length} inputs`,
    );
  }
  return embeddings.map((e, i) => {
    const values = e?.values;
    if (!values || values.length === 0) {
      throw new Error(`Gemini batch embedding returned an empty vector at index ${i}`);
    }
    return values;
  });
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

  const fixtures = discoverFixtures();
  if (fixtures.size === 0) {
    throw new Error(
      `No *.json fixtures found in ${FIXTURES_DIR} or ${PRIVATE_DIR}. ` +
        "Drop your corpus there first (see kb-fixtures/README.md), or run " +
        "`pnpm kb:ingest` to ingest NASM PDFs into kb-fixtures/private/.",
    );
  }

  const sql = neon(dbUrl);

  for (const [namespace, { path, source }] of fixtures) {
    const docs = JSON.parse(readFileSync(path, "utf8"));
    console.log(
      `\n${namespace} (${source}): clearing and seeding ${docs.length} docs...`,
    );

    await sql`DELETE FROM coach_kb WHERE namespace = ${namespace}`;

    for (let i = 0; i < docs.length; i += EMBED_BATCH) {
      const batch = docs.slice(i, i + EMBED_BATCH).map((d) => ({
        source: sanitize(d.source),
        content: sanitize(d.content),
      }));
      const embeddings = await embedBatch(
        batch.map((d) => d.content),
        geminiKey,
      );
      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const literal = `[${embeddings[j].join(",")}]`;
        await sql`
          INSERT INTO coach_kb (namespace, source, content, embedding)
          VALUES (${namespace}, ${doc.source}, ${doc.content}, ${literal}::vector(768))
        `;
      }
      console.log(
        `  embedded + inserted ${Math.min(i + EMBED_BATCH, docs.length)}/${docs.length}`,
      );
    }
  }

  console.log("\nDone seeding coach_kb.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
