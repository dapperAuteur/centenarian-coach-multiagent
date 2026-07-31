// src/app/api/health/route.ts
// Public, unauthenticated readiness probe for uptime monitors (Better Stack).
//
// Why it exists: a monitor pointed at `/` can get a 200 straight from the CDN
// while the database is face down, so the green check means nothing. This route
// is uncacheable and actually touches the one dependency the app cannot serve
// without.
//
// What it deliberately does NOT do, because this is a health-coaching app:
//   * It never reads a user-scoped row. The probe is `select 1` -- a constant,
//     not a table. No user, session, query, or finding is read, counted, or
//     hinted at, and no volume of any kind is reported. A row count is itself a
//     disclosure here (see src/lib/sentry-scrub.ts for the same reasoning).
//   * It never calls an LLM or embeddings provider. A vendor outage must not
//     redden the monitor, provider errors carry live API keys in their bodies,
//     and a probe that costs money per hit is a probe nobody keeps.
//   * It never echoes a caught error. The catch blocks below bind nothing at
//     all, so there is no variable in scope that could reach the response or
//     the log line: a Postgres connection error string contains the DSN, user,
//     and host. The body carries a fixed token and the log carries a fixed
//     literal.
//
// Real failures still reach Sentry/Better Stack through the normal error path
// on the routes that do the work; this endpoint's job is only up-or-down.

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hard ceiling on the dependency probe. A hung socket must fail, not hang. */
const PROBE_TIMEOUT_MS = 4_000;

/** Fixed failure token. Never a message, never a code from the driver. */
const FAILURE_TOKEN = "dependency_unavailable";

const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

/** Reject after PROBE_TIMEOUT_MS rather than waiting on a dead connection. */
function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("health probe timed out")),
      PROBE_TIMEOUT_MS,
    );
  });
  return Promise.race([work, ceiling]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Cheapest honest probe of the database: `select 1`. It proves the connection
 * string resolves, the network path is open, and Postgres is answering -- while
 * reading no table and therefore no health data.
 */
async function databaseIsUp(): Promise<boolean> {
  try {
    await withTimeout(getDb().execute(sql`select 1`));
    return true;
  } catch {
    // No binding on purpose: the driver's message would carry the DSN.
    console.error("[health] database probe failed");
    return false;
  }
}

export async function GET(): Promise<Response> {
  const ok = await databaseIsUp();

  if (!ok) {
    return Response.json(
      { ok: false, error: FAILURE_TOKEN },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  return Response.json(
    { ok: true, service: "centenarian-coach-multiagent", checks: { database: "ok" } },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

/** Same check, no body -- some monitors prefer HEAD. */
export async function HEAD(): Promise<Response> {
  const ok = await databaseIsUp();
  return new Response(null, {
    status: ok ? 200 : 503,
    headers: NO_STORE_HEADERS,
  });
}
