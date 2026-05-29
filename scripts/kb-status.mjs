// scripts/kb-status.mjs
// Read-only status of the coach_kb table. For each namespace it reports the
// row count, the doc_index coverage, any gaps, and a compare against the
// local fixture JSON (so you can see what is left to seed). No writes.
//
// Run:
//   pnpm kb:status                 # every namespace (DB + local JSON)
//   pnpm kb:status workout_kb      # only the listed namespace(s)
//
// Requires: STORAGE_DATABASE_URL (or DATABASE_URL).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const FIXTURES_DIR = resolve(process.cwd(), "kb-fixtures");
const PRIVATE_DIR = resolve(FIXTURES_DIR, "private");

/** Expected doc count per namespace from the local fixture JSON (private
 * overrides public, matching seed-kb's discovery). Map<namespace, count>. */
function discoverExpected() {
  const map = new Map();
  for (const dir of [FIXTURES_DIR, PRIVATE_DIR]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const docs = JSON.parse(readFileSync(join(dir, file), "utf8"));
        if (Array.isArray(docs)) map.set(basename(file, ".json"), docs.length);
      } catch {
        // skip unreadable / invalid JSON
      }
    }
  }
  return map;
}

async function main() {
  const dbUrl = process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "STORAGE_DATABASE_URL (or DATABASE_URL) is not set. " +
        "It must be present in .env.local (run with: pnpm kb:status).",
    );
  }
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const sql = neon(dbUrl);

  const dbRows = await sql`
    SELECT namespace,
           count(*)::int AS rows,
           count(distinct doc_index)::int AS distinct_idx,
           min(doc_index)::int AS min_idx,
           max(doc_index)::int AS max_idx,
           count(*) FILTER (WHERE doc_index IS NULL)::int AS null_idx
    FROM coach_kb
    GROUP BY namespace
  `;
  const dbByNs = new Map(dbRows.map((r) => [r.namespace, r]));
  const expected = discoverExpected();

  let namespaces = [
    ...new Set([...dbByNs.keys(), ...expected.keys()]),
  ].sort();
  if (only.length > 0) namespaces = namespaces.filter((n) => only.includes(n));

  if (namespaces.length === 0) {
    console.log("No coach_kb rows and no fixture JSON found.");
    return;
  }

  for (const ns of namespaces) {
    const db = dbByNs.get(ns);
    const exp = expected.get(ns) ?? null;
    const rows = db?.rows ?? 0;
    const maxIdx = db?.max_idx ?? null;
    const distinct = db?.distinct_idx ?? 0;
    const nullIdx = db?.null_idx ?? 0;
    const gaps = maxIdx == null ? 0 : maxIdx + 1 - distinct;
    const tail = exp != null && maxIdx != null ? exp - (maxIdx + 1) : 0;

    let verdict;
    if (rows === 0) {
      verdict = exp != null ? "not seeded" : "empty";
    } else if (nullIdx > 0) {
      verdict = "needs db:migrate";
    } else if (gaps === 0 && (exp == null || rows >= exp)) {
      verdict = "complete";
    } else {
      verdict = "incomplete";
    }

    const facts = [`rows=${rows}`];
    if (exp != null) facts.push(`expected=${exp}`);
    if (maxIdx != null) facts.push(`idx=[${db.min_idx}..${maxIdx}]`);
    if (nullIdx > 0) facts.push(`null_doc_index=${nullIdx}`);
    console.log(`${ns.padEnd(16)} ${verdict.padEnd(16)} ${facts.join("  ")}`);

    if (nullIdx > 0) {
      console.log(
        `  -> ${nullIdx} row(s) predate the doc_index column; run \`pnpm db:migrate\` to backfill.`,
      );
    }

    // Interior gaps (missing indices within [0, maxIdx]).
    if (maxIdx != null && gaps > 0) {
      const g = await sql`
        WITH missing AS (
          SELECT s FROM generate_series(0, ${maxIdx}) s
          LEFT JOIN coach_kb k ON k.namespace = ${ns} AND k.doc_index = s
          WHERE k.doc_index IS NULL
        )
        SELECT min(s)::int AS first, max(s)::int AS last, count(*)::int AS n,
               (max(s) - min(s) + 1 = count(*)) AS contiguous
        FROM missing
      `;
      const m = g[0];
      if (m && m.n > 0) {
        const fix = m.contiguous
          ? `pnpm kb:seed ${ns} --start=${m.first} --end=${m.last + 1}`
          : `pnpm kb:seed ${ns} --fresh   (gap is non-contiguous)`;
        console.log(
          `  -> missing ${m.n} doc(s) in [${m.first}..${m.last}]; fill with: ${fix}`,
        );
      }
    }

    // Appended-but-not-seeded tail (JSON has more docs than the DB's top idx).
    if (tail > 0) {
      console.log(
        `  -> ${tail} doc(s) in the JSON past idx ${maxIdx} not yet seeded; run: pnpm kb:seed ${ns}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
