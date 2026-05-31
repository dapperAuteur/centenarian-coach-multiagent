"use client";

// src/app/signin/page.tsx
// Single-form sign-in. The admin/waitlist bifurcation happens server-side at
// /api/access-request — there is no client-side ADMIN_EMAIL knowledge here,
// so a missing NEXT_PUBLIC_* env var can no longer lock the admin out.
//
// Flow:
//   1. User submits an email.
//   2. POST /api/access-request — server checks ADMIN_EMAIL:
//        - admin   -> server triggers NextAuth Nodemailer signIn (the
//                     magic-link email is sent in the background) and
//                     returns { outcome: "magic_link_sent" }.
//        - other   -> returns { outcome: "needs_waitlist_confirm" } and
//                     nothing else happens server-side.
//   3. On "needs_waitlist_confirm", the page shows the consent UI. The
//      "Notify me" button posts to /api/waitlist, which inserts into the
//      waitlist table and mirrors the signup to the WitUS Inbox.
// No magic link is ever sent to a non-admin email.

import { useState, type FormEvent } from "react";
import ErrorNotice from "@/components/ErrorNotice";

type Status =
  | "idle"
  | "sending"
  | "sent"
  | "waitlist"
  | "joining"
  | "waitlisted"
  | "error";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const normalized = email.trim().toLowerCase();
  const busy = status === "sending" || status === "joining";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!normalized || busy) return;
    setError(null);
    setRequestId(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        outcome?: string;
        error?: string;
        requestId?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setRequestId(data.requestId ?? res.headers.get("x-request-id"));
        setStatus("error");
        return;
      }
      if (data.outcome === "magic_link_sent") {
        setStatus("sent");
      } else if (data.outcome === "needs_waitlist_confirm") {
        setStatus("waitlist");
      } else {
        throw new Error("Unexpected response from the server.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
      setStatus("error");
    }
  }

  async function joinWaitlist() {
    if (!normalized || busy) return;
    setError(null);
    setRequestId(null);
    setStatus("joining");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          requestId?: string;
        };
        setError(data.error ?? `Request failed (${res.status})`);
        setRequestId(data.requestId ?? res.headers.get("x-request-id"));
        setStatus("error");
        return;
      }
      setStatus("waitlisted");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to join the waitlist.",
      );
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-gray-500">
        This is a single-admin demo. Enter your email to continue.
      </p>

      {status !== "sent" && status !== "waitlisted" && (
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label
            htmlFor="email"
            className="block text-xs font-medium uppercase tracking-wide text-gray-600"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            placeholder="you@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={!normalized || busy}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Continue"}
          </button>
        </form>
      )}

      {status === "sent" && (
        <section className="mt-8 rounded-lg border border-sky-200 bg-sky-50 p-5 text-sm">
          <p className="font-semibold text-gray-900">Check your email</p>
          <p className="mt-1 text-gray-700">
            We sent a sign-in link to{" "}
            <span className="font-mono">{normalized}</span>. The link expires
            shortly. You can close this tab once you've signed in.
          </p>
        </section>
      )}

      {status === "waitlist" && (
        <section className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm">
          <p className="font-semibold text-gray-900">
            This app is private right now
          </p>
          <p className="mt-1 text-gray-700">
            It's a single-admin demo while we get the rough edges off. If you'd
            like to use it when paid access opens up, drop your email on the
            waitlist and we'll let you know.
          </p>
          <button
            type="button"
            onClick={joinWaitlist}
            disabled={busy}
            className="mt-4 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Notify me when paid access is available
          </button>
          <p className="mt-2 text-xs text-gray-500">
            We'll only use <span className="font-mono">{normalized}</span> to
            email you when access opens. No magic link has been sent.
          </p>
        </section>
      )}

      {status === "joining" && (
        <p className="mt-6 text-sm text-gray-500">Adding you to the list…</p>
      )}

      {status === "waitlisted" && (
        <section className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm">
          <p className="font-semibold text-gray-900">You're on the list</p>
          <p className="mt-1 text-gray-700">
            Thanks, we'll email <span className="font-mono">{normalized}</span>{" "}
            when paid access opens. Nothing else needed from you.
          </p>
        </section>
      )}

      {error && (
        <ErrorNotice
          className="mt-4"
          message={error}
          requestId={requestId ?? undefined}
        />
      )}
    </main>
  );
}
