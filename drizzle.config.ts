// drizzle.config.ts
// `pnpm db:generate` only reads the schema (no DB connection needed).
// `pnpm db:migrate` connects via STORAGE_DATABASE_URL (Neon). The PRD names
// this DATABASE_URL; the actual Neon-via-Vercel var is STORAGE_DATABASE_URL,
// so both are accepted.

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
