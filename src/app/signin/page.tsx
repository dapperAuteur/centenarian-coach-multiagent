"use client";

// src/app/signin/page.tsx
// Custom sign-in page. The admin email gets a magic-link sign-in; any other
// address is offered a paid-access waitlist instead — NextAuth's default
// "check your email" UI never fires for non-admin addresses, and **no magic
// link is ever sent** to a non-admin.

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

type Status =
  | "idle"
  | "sending"
  | "sent"
  | "waitlist"
  | "joining"
  | "waitlisted"
  | "error";

// Public so the signin page can bifurcate before triggering NextAuth.
// The server-side ADMIN_EMAIL is the source of truth (auth.ts signIn callback).
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const normalized = email.trim().toLowerCase();
  const isAdminEmail = ADMIN_EMAIL.length > 0 && normalized === ADMIN_EMAIL;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!normalized || status === "sending" || status === "joining") return;
    setError(null);

    if (isAdminEmail) {
      setStatus("sending");
      try {
        const result = await signIn("nodemailer", {
          email: normalized,
          redirect: false,
          callbackUrl: "/coach",
        });
        if (result?.error) {
          throw new Error(result.error);
        }
        setStatus("sent");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send sign-in link.",
        );
        setStatus("error");
      }
    } else {
      // Not the admin — no magic link is sent. Offer the waitlist UX.
      setStatus("waitlist");
    }
  }

  async function joinWaitlist() {
    if (!normalized || status === "joining") return;
    setError(null);
    setStatus("joining");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
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
            disabled={status === "sending" || status === "joining"}
            placeholder="you@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={!normalized || status === "sending" || status === "joining"}
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
            We sent a sign-in link to <span className="font-mono">{normalized}</span>.
            The link expires shortly. You can close this tab once you've signed in.
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
            disabled={status !== "waitlist"}
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
            Thanks — we'll email <span className="font-mono">{normalized}</span>{" "}
            when paid access opens. Nothing else needed from you.
          </p>
        </section>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </main>
  );
}
