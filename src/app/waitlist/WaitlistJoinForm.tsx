"use client";

// src/app/waitlist/WaitlistJoinForm.tsx
// The "yes, add me" half of /waitlist.
//
// IT POSTS TO THE EXISTING POST /api/waitlist — the same endpoint the /signin
// email form already uses, which inserts into the `waitlist` table (unique on
// email, so a repeat submission is a no-op) and mirrors the signup to the central
// WitUS Inbox. This component is a second DOOR to that one mechanism, not a second
// mechanism: nothing here records anything on its own, and it never claims success
// unless the API said ok.
//
// WHY IT ASKS FOR THE EMAIL AGAIN. This page is reached after Auth.js refused a
// sign-in, and Auth.js hands the error page a code — never the address that was
// refused. Prefilling would mean guessing. Asking is the honest version, and it
// also means the person can put a different address on the list than the one they
// signed in with.

import { useState, type FormEvent } from "react";
import ErrorNotice from "@/components/ErrorNotice";

type Status = "idle" | "joining" | "joined" | "error";

export default function WaitlistJoinForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const normalized = email.trim().toLowerCase();
  const busy = status === "joining";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
      setStatus("joined");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to join the waitlist.",
      );
      setStatus("error");
    }
  }

  if (status === "joined") {
    return (
      <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm">
        <p className="font-semibold text-gray-900">You&apos;re on the list</p>
        <p className="mt-1 text-gray-700">
          Thanks — we&apos;ll email{" "}
          <span className="font-mono">{normalized}</span> when paid access opens.
          Nothing else needed from you.
        </p>
      </section>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label
          htmlFor="waitlist-email"
          className="block text-xs font-medium uppercase tracking-wide text-gray-600"
        >
          Email
        </label>
        <input
          id="waitlist-email"
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
          {busy ? "Adding you…" : "Join the waitlist"}
        </button>
        <p className="text-xs text-gray-500">
          We&apos;ll only use it to email you when access opens.
        </p>
      </form>

      {error && (
        <ErrorNotice
          className="mt-4"
          message={error}
          requestId={requestId ?? undefined}
        />
      )}
    </>
  );
}
