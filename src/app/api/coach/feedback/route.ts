// src/app/api/coach/feedback/route.ts
// POST /api/coach/feedback — record a user's thumbs up/down on a coach answer.
// The DB row in coach_feedback is the source of truth; mirroring to LangSmith
// (client.createFeedback, keyed to the run id) is best-effort and never blocks
// or fails the request. Open to any visitor (the coach demo is unauthenticated).

import { z } from "zod";
import { getDb } from "@/lib/db";
import { coachFeedback } from "@/db/schema";
import { getLangsmithClient } from "@/lib/langsmith";
import { apiError, handleRouteError, newRequestId } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  runId: z.string().trim().min(1).nullish(),
  sessionId: z.string().trim().min(1).nullish(),
  score: z.union([z.literal(0), z.literal(1)]),
  comment: z.string().trim().max(2000).nullish(),
});

export async function POST(req: Request): Promise<Response> {
  const requestId = newRequestId();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body", requestId);
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "Invalid feedback", requestId, {
      issues: parsed.error.issues,
    });
  }
  const { runId, sessionId, score, comment } = parsed.data;

  try {
    await getDb()
      .insert(coachFeedback)
      .values({
        runId: runId ?? null,
        sessionId: sessionId ?? null,
        score,
        comment: comment ?? null,
      });

    // Best-effort mirror to LangSmith. A missing key, a missing run id, or any
    // SDK error must not fail the request: the DB row already captured it.
    if (runId) {
      try {
        await getLangsmithClient()?.createFeedback(runId, "user_score", {
          score,
          comment: comment ?? undefined,
        });
      } catch (err) {
        console.error(
          `[coach/feedback] LangSmith mirror failed (requestId=${requestId})`,
          err,
        );
      }
    }

    return Response.json({ ok: true }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return handleRouteError("coach/feedback", err, requestId);
  }
}
