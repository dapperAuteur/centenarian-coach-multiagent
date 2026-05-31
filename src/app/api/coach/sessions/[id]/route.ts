// src/app/api/coach/sessions/[id]/route.ts
// GET /api/coach/sessions/:id — fetch a single session for the detail view.

import { apiError, handleRouteError, newRequestId } from "@/lib/api-error";
import { getSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = newRequestId();
  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) {
      return apiError(404, "Session not found", requestId);
    }
    return Response.json({ session });
  } catch (err) {
    return handleRouteError("coach/sessions/[id]", err, requestId);
  }
}
