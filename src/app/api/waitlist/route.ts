// src/app/api/waitlist/route.ts
// POST { email } — appends the address to the waitlist (idempotent on email).
// Called by the /signin page when a non-admin address asks to be notified.
//
// After the local insert, fires a signed webhook to the central WitUS Inbox
// so BAM can triage signups in the same place as every other sibling
// product's submissions. The webhook runs in `after()` so it never delays
// the JSON response.

import { NextResponse, after } from "next/server";
import { getDb } from "@/lib/db";
import { waitlist } from "@/db/schema";
import { submitToInbox } from "@/lib/submit-to-inbox";
import { apiError, handleRouteError, newRequestId } from "@/lib/api-error";

export const runtime = "nodejs";

interface WaitlistBody {
  email?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  const requestId = newRequestId();
  const body = (await req.json().catch(() => ({}))) as WaitlistBody;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return apiError(400, "A valid email is required.", requestId);
  }

  try {
    await getDb().insert(waitlist).values({ email }).onConflictDoNothing();

    // Mirror the signup to the central WitUS Inbox. Fire-and-forget so the
    // user's response is not delayed; the wrapper logs and short-circuits
    // when the INBOX_* env vars are unset. Every POST fires a webhook,
    // including duplicates — the lowest-risk default per the integration
    // handoff (BAM sees resubmissions in the Inbox queue and can act on
    // them).
    after(async () => {
      await submitToInbox({
        form_type: "waitlist-signup",
        submitter_email: email,
        priority: "normal",
        payload: { email, submitted_at: new Date().toISOString() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError("waitlist", err, requestId);
  }
}
