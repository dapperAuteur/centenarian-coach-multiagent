// src/app/api/coach/sessions/[id]/route.ts
// GET /api/coach/sessions/:id — one coach run with its specialist calls
// (PRD §9). 404s on an unknown id. Admin-gated by middleware.

import { getSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    const session = await getSession(id);
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
    return Response.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
