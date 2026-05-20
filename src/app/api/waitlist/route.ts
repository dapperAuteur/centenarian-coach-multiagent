// src/app/api/waitlist/route.ts
// POST { email } — appends the address to the waitlist (idempotent on email).
// Called by the /signin page when a non-admin address asks to be notified.

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { waitlist } from "@/db/schema";

export const runtime = "nodejs";

interface WaitlistBody {
  email?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as WaitlistBody;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }

  try {
    await getDb().insert(waitlist).values({ email }).onConflictDoNothing();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Insert failed" },
      { status: 500 },
    );
  }
}
