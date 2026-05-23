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
//
// Run:
//   pnpm kb:seed                          # all namespaces
//   pnpm kb:seed nutrition_kb workout_kb  # only the listed namespaces
//
// Requires: STORAGE_DATABASE_URL (or DATABASE_URL), GOOGLE_GEMINI_API_KEY.
//
// Idempotent: deletes a namespace's rows before re-inserting them.
//
// Pacing: each item in a Gemini batchEmbedContents call counts against the
// per-minute embed quota, so a single 100-item batch consumes 100 RPM.
// The script paces batches to stay under the cap and retries on 429 using
// the delay Gemini suggests. Default RPM is the free tier (100); override
// via EMBED_RPM=<n> in .env.local once you upgrade.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;

const FIXTURES_DIR = resolve(process.cwd(), "kb-fixtures");
const PRIVATE_DIR = resolve(FIXTURES_DIR, "private");

// Free-tier RPM for embed_content. Each item in a batch counts.
const DEFAULT_RPM = 100;
// Stay this fraction under the cap to absorb clock skew / other usage.
const RPM_SAFETY = 0.95;
// Max items the Gemini batch endpoint accepts in one call.
const MAX_BATCH = 100;
// Per-batch retry budget when Gemini returns 429.
const RETRY_ATTEMPTS = 4;

// C0 control chars Postgres rejects in `text` columns (most importantly
// 0x00, which pdfjs sometimes emits from quirky embedded fonts).
// Keep TAB, LF, CR.
const C0_NOISE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const sanitize = (s) => (typeof s === "string" ? s.replace(C0_NOISE, "") : s);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class GeminiRateLimitError extends Error {
  /** @param {string} message @param {number} retryAfterMs */
  constructor(message, retryAfterMs) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

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

/** Parse a Gemini 429 response body for the recommended retry delay (ms).
 * Falls back to 30s when neither the RetryInfo block nor an inline hint is
 * present. */
function parseRetryDelayMs(body) {
  try {
    const json = JSON.parse(body);
    const details = json?.error?.details ?? [];
    for (const d of details) {
      const t = d?.["@type"];
      if (typeof t === "string" && t.includes("RetryInfo") && d.retryDelay) {
        const m = String(d.retryDelay).match(/^(\d+(?:\.\d+)?)s$/);
        if (m) return Math.ceil(parseFloat(m[1]) * 1000);
      }
    }
    const inline = String(json?.error?.message ?? "").match(
      /retry in (\d+(?:\.\d+)?)s/i,
    );
    if (inline) return Math.ceil(parseFloat(inline[1]) * 1000);
  } catch {
    // body wasn't JSON
  }
  return 30_000;
}

/** Embed up to MAX_BATCH inputs in one Gemini API call. */
async function embedBatch(texts, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;
  const requests = texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMS,
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) {
      const wait = parseRetryDelayMs(body);
      throw new GeminiRateLimitError(
        `Gemini rate limit hit (429); suggested retry in ~${Math.ceil(wait / 1000)}s`,
        wait,
      );
    }
    throw new Error(`Gemini batch embedding failed (${res.status}): ${body}`);
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

/** embedBatch + retry on 429 using Gemini's suggested delay. */
async function embedBatchWithRetry(texts, apiKey) {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await embedBatch(texts, apiKey);
    } catch (err) {
      if (err instanceof GeminiRateLimitError && attempt < RETRY_ATTEMPTS) {
        const wait = err.retryAfterMs + 1_000;
        console.log(
          `  429 (attempt ${attempt}/${RETRY_ATTEMPTS}); sleeping ${Math.ceil(wait / 1000)}s then retrying...`,
        );
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw new Error("embedBatchWithRetry: exhausted retries");
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

  const rpm = Math.max(1, Number(process.env.EMBED_RPM ?? DEFAULT_RPM));
  const effectiveRpm = Math.max(1, Math.floor(rpm * RPM_SAFETY));
  const batchSize = Math.min(MAX_BATCH, effectiveRpm);
  const minIntervalMs = Math.ceil((batchSize / effectiveRpm) * 60_000);

  const onlyNamespaces = process.argv
    .slice(2)
    .filter((a) => !a.startsWith("--"));

  const fixtures = discoverFixtures();
  if (fixtures.size === 0) {
    throw new Error(
      `No *.json fixtures found in ${FIXTURES_DIR} or ${PRIVATE_DIR}. ` +
        "Drop your corpus there first (see kb-fixtures/README.md), or run " +
        "`pnpm kb:ingest` to ingest NASM PDFs into kb-fixtures/private/.",
    );
  }
  if (onlyNamespaces.length > 0) {
    const unknown = onlyNamespaces.filter((n) => !fixtures.has(n));
    if (unknown.length > 0) {
      throw new Error(
        `Unknown namespace(s): ${unknown.join(", ")}. ` +
          `Available: ${[...fixtures.keys()].join(", ")}`,
      );
    }
  }

  console.log(
    `Pacing: RPM=${rpm} (effective ${effectiveRpm}), batch=${batchSize}, ` +
      `~${(minIntervalMs / 1000).toFixed(1)}s between batches. ` +
      `Override with EMBED_RPM=<n> in .env.local on a paid tier.`,
  );

  const sql = neon(dbUrl);
  let lastBatchAt = 0;

  for (const [namespace, { path, source }] of fixtures) {
    if (onlyNamespaces.length > 0 && !onlyNamespaces.includes(namespace)) {
      console.log(`\n${namespace}: skipped (not in arg list).`);
      continue;
    }
    const docs = JSON.parse(readFileSync(path, "utf8"));
    const batchCount = Math.ceil(docs.length / batchSize);
    const estMinutes = Math.ceil((batchCount * minIntervalMs) / 60_000);
    console.log(
      `\n${namespace} (${source}): ${docs.length} docs in ${batchCount} batches; ` +
        `est ~${estMinutes} min at ${rpm} RPM.`,
    );

    await sql`DELETE FROM coach_kb WHERE namespace = ${namespace}`;

    for (let i = 0; i < docs.length; i += batchSize) {
      // Stay under the per-minute quota: gate from the *finish* time of
      // the previous batch (set after the call returns, below).
      if (lastBatchAt > 0) {
        const wait = lastBatchAt + minIntervalMs - Date.now();
        if (wait > 0) {
          console.log(
            `  rate-limit: sleeping ${Math.ceil(wait / 1000)}s before next batch...`,
          );
          await sleep(wait);
        }
      }

      const batch = docs.slice(i, i + batchSize).map((d) => ({
        source: sanitize(d.source),
        content: sanitize(d.content),
      }));
      const embeddings = await embedBatchWithRetry(
        batch.map((d) => d.content),
        geminiKey,
      );
      lastBatchAt = Date.now();

      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const literal = `[${embeddings[j].join(",")}]`;
        await sql`
          INSERT INTO coach_kb (namespace, source, content, embedding)
          VALUES (${namespace}, ${doc.source}, ${doc.content}, ${literal}::vector(768))
        `;
      }
      console.log(
        `  embedded + inserted ${Math.min(i + batchSize, docs.length)}/${docs.length}`,
      );
    }
  }

  console.log("\nDone seeding coach_kb.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
