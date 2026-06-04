// scripts/seed-kb.mjs
// Seeds the coach_kb table from kb-fixtures/. Each *.json file's basename is
// the namespace (e.g. nutrition_kb.json -> namespace 'nutrition_kb').
// Two source dirs:
//   - kb-fixtures/*.json          public; tracked by git. Ships a real starter
//                                 corpus (~296 open-access study abstracts) so a
//                                 fresh clone has a working coach with no extra files.
//   - kb-fixtures/private/*.json  gitignored; the operator's own corpus
//                                 (e.g. ingested PDFs via `pnpm kb:ingest`).
// When the same namespace exists in both, the private file wins. The private dir is
// optional: with no private/, seeding runs on the public corpus alone.
//
// Prerequisite: apply the migration in src/db/migrations first.
//
// Run:
//   pnpm kb:seed                          # all namespaces, full range
//   pnpm kb:seed nutrition_kb workout_kb  # only the listed namespaces
//   pnpm kb:seed --fresh                  # delete + re-seed (default
//                                         #   is resume from where DB left off)
//   pnpm kb:seed nutrition_kb --start=0 --end=3793     # meet-in-the-middle
//   pnpm kb:seed nutrition_kb --start=3793 --end=7585  # on a second machine
//
// Requires: STORAGE_DATABASE_URL (or DATABASE_URL). For the Gemini
// backend, also GOOGLE_GEMINI_API_KEY. For the Ollama backend, a local
// `ollama serve` reachable at OLLAMA_BASE_URL.
//
// Backend (COACH_EMBED_PROVIDER):
//   - "gemini" (default) — cloud, 768-dim, free-tier 100 RPM / ~1000 RPD.
//   - "ollama"           — local, free, no rate limit. Defaults to
//                          nomic-embed-text (768-dim); override with
//                          OLLAMA_EMBED_MODEL. Must produce 768-dim
//                          vectors to fit coach_kb.embedding vector(768).
// Both seed-time and query-time embeddings flow through the same
// COACH_EMBED_PROVIDER value, kept aligned via src/lib/embeddings.ts.
// Switching backend means re-seeding: vectors from different backends
// don't share a space. Use pnpm kb:clear --all && pnpm kb:seed --fresh.
//
// Resume: the script tracks per-row position via the `doc_index` column on
// coach_kb. Default mode counts existing rows for the namespace and skips
// to max(doc_index)+1, so a run interrupted by a quota wall or a battery
// death picks up where it left off. Pass --fresh to force a DELETE +
// re-seed of the targeted range. Resume assumes the JSON file has not
// changed since the partial run; pass --fresh if you re-ingested.
//
// Range mode: --start=N --end=M restrict the script to processing JSON
// indices [N, M). Resume queries scope to that range only, so two
// machines can split a single namespace meet-in-the-middle (A: --start=0
// --end=3793, B: --start=3793 --end=7585) and each resumes independently
// if killed. --fresh in range mode wipes only the targeted range. Range
// mode requires exactly one namespace argument and the doc_index column
// from migration 0003 (run `pnpm db:migrate` first).
//
// Pacing (Gemini only): each item in a batchEmbedContents call counts
// against the per-minute embed quota, so a single 100-item batch
// consumes 100 RPM. We track every sent batch in a sliding 60-second
// window and never let the window's total exceed EFFECTIVE_RPM (75% of
// EMBED_RPM by default, to absorb timing slop / clock skew / unrelated
// app traffic on the same key). On a per-minute 429 we wait at least
// 60s and clear our local counter. On a per-DAY 429 (free tier caps
// embed at ~1000 RPD) we fail fast — no amount of pacing helps; the
// quota resets at midnight Pacific. Set EMBED_RPM=<n> in .env.local
// once you upgrade to a paid Gemini plan. Ollama has no rate limit and
// skips this layer entirely.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { Agent, setGlobalDispatcher } from "undici";

const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_EMBED_MODEL = "nomic-embed-text";
// Conservative local-batch size. Override with OLLAMA_EMBED_BATCH in
// .env.local — bigger on Apple Silicon, smaller if you're on Intel CPU and
// hitting timeouts on big chunks. 10 gives reasonably frequent progress
// logging without hammering the HTTP overhead path.
const DEFAULT_OLLAMA_BATCH = 10;
// Headers/body timeout we configure on the global fetch dispatcher when
// Ollama is the backend. Node's undici default is 5 minutes; embeddings on
// slower CPUs (Intel, larger chunks) can comfortably exceed that for a
// batch of 10+ paragraph-sized docs.
const OLLAMA_FETCH_TIMEOUT_MS = 30 * 60_000;

const FIXTURES_DIR = resolve(process.cwd(), "kb-fixtures");
const PRIVATE_DIR = resolve(FIXTURES_DIR, "private");

// Free-tier RPM for embed_content. Each item in a batch counts.
const DEFAULT_RPM = 100;
// Stay this fraction under the cap. Conservative on purpose: 95% of cap
// repeatedly tripped 429s under real load, presumably because Gemini
// counts rejected requests, clocks drift, and the same API key may be
// used by the running coach for query-time embeddings.
const RPM_SAFETY = 0.75;
// Max items the Gemini batch endpoint accepts in one call.
const MAX_BATCH = 100;
// Sliding-window length matching Gemini's per-minute quota.
const WINDOW_MS = 60_000;
// Per-batch retry budget when Gemini returns 429.
const RETRY_ATTEMPTS = 6;

// C0 control chars Postgres rejects in `text` columns (most importantly
// 0x00, which pdfjs sometimes emits from quirky embedded fonts).
// Keep TAB, LF, CR.
const C0_NOISE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const sanitize = (s) => (typeof s === "string" ? s.replace(C0_NOISE, "") : s);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class GeminiRateLimitError extends Error {
  /** @param {string} message @param {number} retryAfterMs @param {"minute"|"daily"|"unknown"} kind */
  constructor(message, retryAfterMs, kind) {
    super(message);
    this.retryAfterMs = retryAfterMs;
    this.kind = kind;
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

/** Classify a Gemini 429 by quota window. Free tier embed has both a
 * per-minute (100 RPM) and per-day (~1000 RPD) cap; the script needs to
 * react differently to each — the daily wall is not waitable. */
function parseQuotaKind(body) {
  try {
    const json = JSON.parse(body);
    const details = json?.error?.details ?? [];
    for (const d of details) {
      const t = d?.["@type"];
      if (typeof t !== "string" || !/QuotaFailure/.test(t)) continue;
      for (const v of d?.violations ?? []) {
        const qid = String(v?.quotaId ?? "");
        if (/PerDay/i.test(qid)) return "daily";
        if (/PerMinute/i.test(qid)) return "minute";
      }
    }
  } catch {
    // body wasn't JSON
  }
  return "unknown";
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`;
  const requests = texts.map((text) => ({
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
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
      const kind = parseQuotaKind(body);
      throw new GeminiRateLimitError(
        `Gemini rate limit hit (429, ${kind} quota); suggested retry in ~${Math.ceil(wait / 1000)}s`,
        wait,
        kind,
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
      throw new Error(
        `Gemini batch embedding returned an empty vector at index ${i}`,
      );
    }
    return values;
  });
}

// Sliding-window pacing.
/** @type {{ at: number, count: number }[]} */
const recentSends = [];

function pruneWindow(now) {
  while (recentSends.length > 0 && now - recentSends[0].at >= WINDOW_MS) {
    recentSends.shift();
  }
}

/** Block until `needed` request slots are available within the sliding
 * 60-second window, given the effective per-minute cap. Counts toward
 * Gemini's view of the world, so we record every attempted send (even
 * ones that come back 429) until we explicitly clear after a long wait. */
async function waitForCapacity(needed, effectiveRpm) {
  // First-batch (or post-clear) fast path.
  for (;;) {
    const now = Date.now();
    pruneWindow(now);
    const used = recentSends.reduce((s, e) => s + e.count, 0);
    if (used + needed <= effectiveRpm) return;
    const oldest = recentSends[0];
    const wait = Math.max(500, WINDOW_MS - (now - oldest.at) + 200);
    console.log(
      `  rate-limit: ${used}+${needed} would exceed ${effectiveRpm}/min; ` +
        `waiting ${Math.ceil(wait / 1000)}s for capacity...`,
    );
    await sleep(wait);
  }
}

function recordSend(count) {
  recentSends.push({ at: Date.now(), count });
}

/** embedBatch + capacity reservation + 429 retry. Per-minute 429s back off
 * one window and retry. Per-day 429s fail fast — no amount of waiting
 * inside this run will help. */
async function embedBatchPaced(texts, apiKey, effectiveRpm) {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    await waitForCapacity(texts.length, effectiveRpm);
    recordSend(texts.length);
    try {
      return await embedBatch(texts, apiKey);
    } catch (err) {
      if (err instanceof GeminiRateLimitError) {
        if (err.kind === "daily") {
          // Daily wall: free tier embed caps at ~1000 RPD. Stop fast so the
          // operator can resume tomorrow (or upgrade) without burning the
          // retry budget on a hopeless wait.
          throw new Error(
            "Gemini DAILY quota exhausted (RPD). Free-tier embed limit is " +
              "~1000 requests/day; the counter resets at midnight Pacific. " +
              "Re-run `pnpm kb:seed` then to resume from where this stopped " +
              "(previously-inserted rows are preserved). Or upgrade to a " +
              "paid Gemini tier and set EMBED_RPM=<higher> in .env.local.",
          );
        }
        if (attempt < RETRY_ATTEMPTS) {
          // Per-minute 429: wait at least one full window. Gemini's
          // suggested retry can be optimistic after a burst, and our
          // sliding-window record is suspect (we just over-counted vs their
          // view), so clear it.
          const wait = Math.max(err.retryAfterMs, WINDOW_MS) + 1_000;
          console.log(
            `  429 minute quota (attempt ${attempt}/${RETRY_ATTEMPTS}); sleeping ${Math.ceil(wait / 1000)}s then retrying...`,
          );
          await sleep(wait);
          recentSends.length = 0;
          continue;
        }
      }
      throw err;
    }
  }
  throw new Error("embedBatchPaced: exhausted retries");
}

/** Embed a batch via a local Ollama instance. No rate-limit pacing — the
 * local CPU/GPU is the bottleneck, and chunking is only for HTTP overhead.
 * Validates dimension on the first vector so a non-768 model gives a
 * helpful error rather than a Postgres cast failure. */
async function embedBatchOllama(texts, baseUrl, model) {
  let res;
  try {
    res = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const causeMsg =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : "";
    if (/timeout/i.test(msg) || /timeout/i.test(causeMsg)) {
      throw new Error(
        `Ollama embed timed out after ${Math.round(OLLAMA_FETCH_TIMEOUT_MS / 60_000)} min. ` +
          `Your CPU is taking too long to embed this batch. Try a smaller ` +
          `batch: set OLLAMA_EMBED_BATCH=5 in .env.local and re-run.`,
      );
    }
    throw new Error(
      `Could not reach Ollama at ${baseUrl} (${msg}). ` +
        `Is \`ollama serve\` running? Try \`curl ${baseUrl}/api/tags\` to check.`,
    );
  }
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404 && /model.*not found|pull/i.test(body)) {
      throw new Error(
        `Ollama model "${model}" is not pulled. Run \`ollama pull ${model}\` and retry.`,
      );
    }
    throw new Error(`Ollama embed failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const embeddings = data?.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error(
      `Ollama returned ${embeddings?.length} embeddings for ${texts.length} inputs`,
    );
  }
  if (embeddings[0]?.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Ollama model "${model}" returned ${embeddings[0]?.length}-dim vectors; ` +
        `coach_kb expects ${EMBEDDING_DIMS}. Use a 768-dim model such as ` +
        `nomic-embed-text. Set OLLAMA_EMBED_MODEL to override.`,
    );
  }
  for (let i = 0; i < embeddings.length; i++) {
    if (!embeddings[i] || embeddings[i].length === 0) {
      throw new Error(`Ollama returned an empty vector at index ${i}`);
    }
  }
  return embeddings;
}

/** Parse a `--<name>=<int>` flag from process argv. Returns null when the
 * flag is absent. Throws on an empty value, a non-integer, or a negative
 * value. The empty-value check matters because `--start= 5180` is shell-
 * tokenized into `--start=` + `5180` (two args), and we want a loud error
 * instead of silently parsing as 0 and re-embedding from scratch. */
function parseRangeFlag(args, name) {
  const prefix = `--${name}=`;
  const flag = args.find((a) => a.startsWith(prefix));
  if (!flag) return null;
  const value = flag.slice(prefix.length);
  if (value === "") {
    throw new Error(
      `--${name}= has no value. Write it as --${name}=<integer> with no ` +
        `spaces around the equals sign (e.g. --${name}=5180).`,
    );
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `Invalid --${name}=${value}; must be a non-negative integer.`,
    );
  }
  return n;
}

async function main() {
  const provider =
    (process.env.COACH_EMBED_PROVIDER ?? "").toLowerCase() === "ollama"
      ? "ollama"
      : "gemini";

  const dbUrl = process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "Missing env var: STORAGE_DATABASE_URL (or DATABASE_URL). " +
        "Must be present in .env.local (run with: pnpm kb:seed).",
    );
  }

  let geminiKey = null;
  let ollamaBaseUrl = "";
  let ollamaModel = "";
  if (provider === "gemini") {
    geminiKey =
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error(
        "GEMINI_API_KEY (or GOOGLE_GEMINI_API_KEY) is required for the " +
          "Gemini backend. Set it in .env.local, or set " +
          "COACH_EMBED_PROVIDER=ollama to use a local Ollama instance.",
      );
    }
  } else {
    ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
    ollamaModel =
      process.env.OLLAMA_EMBED_MODEL ?? DEFAULT_OLLAMA_EMBED_MODEL;
    // Extend the global fetch timeouts — Intel CPUs embedding paragraph-sized
    // batches routinely exceed undici's 5-minute default and fail with
    // "Headers Timeout Error" before the response lands.
    setGlobalDispatcher(
      new Agent({
        headersTimeout: OLLAMA_FETCH_TIMEOUT_MS,
        bodyTimeout: OLLAMA_FETCH_TIMEOUT_MS,
      }),
    );
  }

  const rpm = Math.max(1, Number(process.env.EMBED_RPM ?? DEFAULT_RPM));
  const effectiveRpm = Math.max(1, Math.floor(rpm * RPM_SAFETY));
  const ollamaBatch = Math.max(
    1,
    Number(process.env.OLLAMA_EMBED_BATCH ?? DEFAULT_OLLAMA_BATCH),
  );
  const batchSize =
    provider === "ollama" ? ollamaBatch : Math.min(MAX_BATCH, effectiveRpm);

  const args = process.argv.slice(2);
  const fresh = args.includes("--fresh");
  const startFlag = parseRangeFlag(args, "start");
  const endFlag = parseRangeFlag(args, "end");
  if (startFlag != null && endFlag != null && startFlag >= endFlag) {
    throw new Error(
      `--start (${startFlag}) must be less than --end (${endFlag}).`,
    );
  }
  const isRangeMode = startFlag != null || endFlag != null;
  const onlyNamespaces = args.filter((a) => !a.startsWith("--"));
  if (isRangeMode && onlyNamespaces.length !== 1) {
    throw new Error(
      "--start/--end requires exactly one namespace. " +
        `Got: ${onlyNamespaces.length === 0 ? "no namespace" : onlyNamespaces.join(", ")}. ` +
        "Example: pnpm kb:seed nutrition_kb --start=0 --end=3793",
    );
  }

  const fixtures = discoverFixtures();
  if (fixtures.size === 0) {
    throw new Error(
      `No *.json fixtures found in ${FIXTURES_DIR} or ${PRIVATE_DIR}. ` +
        "Drop your corpus there first (see kb-fixtures/README.md), or run " +
        "`pnpm kb:ingest` to ingest your PDFs into kb-fixtures/private/.",
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

  if (provider === "ollama") {
    console.log(
      `Embed backend: Ollama (${ollamaModel} @ ${ollamaBaseUrl}). ` +
        `Local, no rate limit. Batch=${batchSize} ` +
        `(override with OLLAMA_EMBED_BATCH=<n> in .env.local). ` +
        `Fetch timeout=${Math.round(OLLAMA_FETCH_TIMEOUT_MS / 60_000)}min/batch. ` +
        `Switch backends via COACH_EMBED_PROVIDER — mixing backends in one ` +
        `namespace breaks retrieval (different vector spaces).`,
    );
  } else {
    console.log(
      `Embed backend: Gemini (${GEMINI_EMBEDDING_MODEL}). ` +
        `Pacing: RPM=${rpm} (effective ${effectiveRpm}), batch=${batchSize}, ` +
        `sliding 60s window. Override with EMBED_RPM=<n> in .env.local on a paid tier.`,
    );
  }

  const sql = neon(dbUrl);

  for (const [namespace, { path, source }] of fixtures) {
    if (onlyNamespaces.length > 0 && !onlyNamespaces.includes(namespace)) {
      console.log(`\n${namespace}: skipped (not in arg list).`);
      continue;
    }
    const docs = JSON.parse(readFileSync(path, "utf8"));

    // Resolve [rangeStart, rangeEnd) for this namespace. Without flags it's
    // the whole JSON; with --start/--end it's the operator-specified slice.
    const rangeStart = startFlag ?? 0;
    const rangeEnd = Math.min(endFlag ?? docs.length, docs.length);
    if (rangeStart >= docs.length) {
      console.warn(
        `\n${namespace} (${source}): --start=${rangeStart} is at or past ` +
          `docs.length (${docs.length}); nothing to do.`,
      );
      continue;
    }
    if (rangeStart >= rangeEnd) {
      console.warn(
        `\n${namespace} (${source}): empty range [${rangeStart}, ${rangeEnd}); ` +
          `nothing to do.`,
      );
      continue;
    }

    // Resume / fresh-start logic via doc_index. --fresh wipes only the
    // targeted range (which IS the whole namespace when no range flags
    // were passed, since rangeStart=0, rangeEnd=docs.length).
    let startIdx;
    if (fresh) {
      await sql`
        DELETE FROM coach_kb
        WHERE namespace = ${namespace}
          AND doc_index >= ${rangeStart}
          AND doc_index < ${rangeEnd}
      `;
      startIdx = rangeStart;
      console.log(
        `\n${namespace} (${source}): --fresh; cleared rows in ` +
          `[${rangeStart}, ${rangeEnd}); seeding ${rangeEnd - rangeStart} docs.`,
      );
    } else {
      // Defensive: catch pre-migration rows where doc_index is NULL. Range
      // resume relies on doc_index, so we can't trust the DB until those
      // are backfilled (migration 0003).
      const legacy = await sql`
        SELECT count(*)::int AS n FROM coach_kb
        WHERE namespace = ${namespace} AND doc_index IS NULL
      `;
      const legacyCount = legacy[0]?.n ?? 0;
      if (legacyCount > 0) {
        throw new Error(
          `${namespace}: ${legacyCount} row(s) have NULL doc_index. ` +
            `Run \`pnpm db:migrate\` to apply migration 0003 (backfills ` +
            `doc_index from created_at order), then re-run kb:seed.`,
        );
      }

      const maxRows = await sql`
        SELECT max(doc_index)::int AS m FROM coach_kb
        WHERE namespace = ${namespace}
          AND doc_index >= ${rangeStart}
          AND doc_index < ${rangeEnd}
      `;
      const maxIdx = maxRows[0]?.m;
      startIdx = maxIdx == null ? rangeStart : maxIdx + 1;

      if (startIdx >= rangeEnd) {
        console.log(
          `\n${namespace} (${source}): range [${rangeStart}, ${rangeEnd}) ` +
            `already complete; nothing to do. Use --fresh to re-seed.`,
        );
        continue;
      }

      if (startIdx > rangeStart) {
        console.log(
          `\n${namespace} (${source}): resuming at ${startIdx} within ` +
            `[${rangeStart}, ${rangeEnd}); ${rangeEnd - startIdx} docs to embed. ` +
            `(assumes JSON unchanged; pass --fresh to wipe this range)`,
        );
      } else if (isRangeMode) {
        console.log(
          `\n${namespace} (${source}): seeding [${rangeStart}, ${rangeEnd}) ` +
            `(${rangeEnd - rangeStart} docs).`,
        );
      } else {
        console.log(`\n${namespace} (${source}): seeding ${docs.length} docs.`);
      }
    }

    const remaining = rangeEnd - startIdx;
    const batchCount = Math.ceil(remaining / batchSize);
    if (provider === "gemini") {
      const estMinutes = Math.ceil(remaining / effectiveRpm);
      console.log(
        `  ${batchCount} batches; est ~${estMinutes} min at ${effectiveRpm} effective RPM.`,
      );
    } else {
      console.log(`  ${batchCount} batches (Ollama, no rate limit).`);
    }

    for (let i = startIdx; i < rangeEnd; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, rangeEnd);
      const batch = docs.slice(i, batchEnd).map((d) => ({
        source: sanitize(d.source),
        content: sanitize(d.content),
      }));
      const embeddings =
        provider === "ollama"
          ? await embedBatchOllama(
              batch.map((d) => d.content),
              ollamaBaseUrl,
              ollamaModel,
            )
          : await embedBatchPaced(
              batch.map((d) => d.content),
              geminiKey,
              effectiveRpm,
            );
      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const docIdx = i + j;
        const literal = `[${embeddings[j].join(",")}]`;
        await sql`
          INSERT INTO coach_kb (namespace, source, content, embedding, doc_index)
          VALUES (${namespace}, ${doc.source}, ${doc.content}, ${literal}::vector(768), ${docIdx})
        `;
      }
      console.log(`  embedded + inserted ${batchEnd}/${rangeEnd}`);
    }
  }

  console.log("\nDone seeding coach_kb.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
