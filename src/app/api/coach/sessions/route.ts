// src/app/api/coach/sessions/route.ts
// GET /api/coach/sessions — the most recent coach runs, newest first
// (PRD §9). Admin-gated by middleware along with the rest of /api/coach/*.

import { listSessions } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const sessions = await listSessions(50);
    return Response.json({ sessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
