// src/app/api/access-request/route.ts
// POST { email } — the single entry point for the /signin page.
//
// Bifurcates server-side so the admin-vs-waitlist decision relies only on
// ADMIN_EMAIL (a server-side env var). It is no longer dependent on
// NEXT_PUBLIC_ADMIN_EMAIL being inlined at the production build time, which
// silently routed the admin into the waitlist branch on Vercel deploys that
// were built before the public var was available.
//
//   - admin email   -> server-side `signIn("nodemailer", ...)` sends the
//                      magic link; respond { outcome: "magic_link_sent" }
//   - any other email -> respond { outcome: "needs_waitlist_confirm" } and
//                      let the client render the consent UI; no magic link
//                      is ever sent, and nothing is written to the waitlist
//                      until the user clicks "Notify me" (POST /api/waitlist).

import { NextResponse } from "next/server";
import { signIn } from "@/auth";

export const runtime = "nodejs";

interface AccessRequestBody {
  email?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as AccessRequestBody;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const isAdmin = adminEmail.length > 0 && email === adminEmail;

  if (!isAdmin) {
    // Don't tell the caller whether the address was rejected or simply
    // didn't match — both produce the same response and the same UI.
    return NextResponse.json({ outcome: "needs_waitlist_confirm" });
  }

  try {
    await signIn("nodemailer", {
      email,
      redirect: false,
      redirectTo: "/coach",
    });
    return NextResponse.json({ outcome: "magic_link_sent" });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to send sign-in link.",
      },
      { status: 500 },
    );
  }
}
