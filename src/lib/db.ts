// src/lib/db.ts
// Drizzle client over a Neon serverless connection. The PRD names the
// connection var DATABASE_URL; the actual Neon-via-Vercel var is
// STORAGE_DATABASE_URL, so both are accepted.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

function connectionString(): string {
  const url = process.env.STORAGE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("STORAGE_DATABASE_URL (or DATABASE_URL) is not set");
  }
  return url;
}

export function getDb() {
  return drizzle(neon(connectionString()), { schema });
}
