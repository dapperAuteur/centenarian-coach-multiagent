// drizzle.config.ts
// `pnpm db:generate` only reads the schema (no DB connection needed).
// `pnpm db:migrate` connects via STORAGE_DATABASE_URL (Neon). The PRD names
// this DATABASE_URL; the actual Neon-via-Vercel var is STORAGE_DATABASE_URL,
// so both are accepted.

import { defineConfig } from "drizzle-kit";

// Load .env.local so STORAGE_DATABASE_URL is available to `pnpm db:migrate`.
// process.loadEnvFile exists on Node 20.12+/22; guarded so a missing file or
// older runtime doesn't break `db:generate` (which needs no connection).
const loadEnvFile = (
  process as unknown as { loadEnvFile?: (path?: string) => void }
).loadEnvFile;
try {
  loadEnvFile?.(".env.local");
} catch {
  // .env.local absent — fine for db:generate.
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
