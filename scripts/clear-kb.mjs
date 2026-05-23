// scripts/clear-kb.mjs
// Deletes coach_kb rows by namespace. The companion `seed-kb.mjs` only
// DELETEs namespaces it is about to re-insert, so retiring a fixture file
// leaves its rows orphaned in the DB — this script is the explicit purge.
//
// Run:  pnpm kb:clear nutrition_kb workout_kb recovery_kb
//   or: pnpm kb:clear --all
// Requires: STORAGE_DATABASE_URL (or DATABASE_URL).

import { neon } from "@neondatabase/serverless";

async function main() {
  const dbUrl = process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "STORAGE_DATABASE_URL (or DATABASE_URL) is not set. " +
        "It must be present in .env.local (run with: pnpm kb:clear).",
    );
  }

  const args = process.argv.slice(2);
  if (args.length === 0) {
    throw new Error(
      "Usage: pnpm kb:clear <namespace> [<namespace> ...]  |  pnpm kb:clear --all",
    );
  }

  const sql = neon(dbUrl);

  if (args.includes("--all")) {
    const before = await sql`SELECT count(*)::int AS n FROM coach_kb`;
    const total = before[0]?.n ?? 0;
    await sql`DELETE FROM coach_kb`;
    console.log(`Cleared all coach_kb rows (${total} deleted).`);
    return;
  }

  for (const namespace of args) {
    const before = await sql`
      SELECT count(*)::int AS n FROM coach_kb WHERE namespace = ${namespace}
    `;
    const n = before[0]?.n ?? 0;
    await sql`DELETE FROM coach_kb WHERE namespace = ${namespace}`;
    console.log(`Cleared namespace '${namespace}' (${n} rows deleted).`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
