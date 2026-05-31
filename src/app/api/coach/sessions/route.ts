// src/app/api/coach/sessions/route.ts
// GET /api/coach/sessions — list recent coach sessions for the history view.

import { handleRouteError, newRequestId } from "@/lib/api-error";
import { listSessions } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = newRequestId();
  try {
    const sessions = await listSessions(50);
    return Response.json({ sessions });
  } catch (err) {
    return handleRouteError("coach/sessions", err, requestId);
  }
}
