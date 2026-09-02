// src/app/waitlist/page.tsx
// Where a refused sign-in lands. Public — middleware.ts gates only /coach and
// /admin, and this page must be reachable by exactly the people who have no
// session.
//
// WHY IT EXISTS. Centenarian Coach is a single-admin app: src/auth.ts completes a
// sign-in only for ADMIN_EMAIL. Before this page, someone who signed in with a
// perfectly good WitUS account hit Auth.js's raw /api/auth/error?error=AccessDenied
// — no explanation, no link back, nowhere to go. BAM (2026-09-01): "route them to
// waitlist and ask them if they want to join waitlist". src/auth.config.ts points
// `pages.error` at /signin, which forwards AccessDenied here
// (src/lib/auth-error.ts).
//
// IT RECORDS SOMETHING REAL. The join button posts to the EXISTING
// POST /api/waitlist, which inserts into the `waitlist` table (unique on email, so
// re-submitting is a no-op) and mirrors the signup to the central WitUS Inbox. No
// second waitlist mechanism was invented for this page.
//
// `?from=sso` only chooses the wording. It is a query param a stranger can type,
// so it gates nothing.

import Link from "next/link";
import WaitlistJoinForm from "./WaitlistJoinForm";

export const metadata = {
  title: "Join the waitlist",
};

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params?.from;
  const from = Array.isArray(raw) ? raw[0] : raw;
  const refused = from === "sso";

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">
        {refused ? "That account doesn't have access here" : "Join the waitlist"}
      </h1>

      {refused ? (
        <p className="mt-3 text-sm text-gray-700">
          Your WitUS sign-in worked — the account just isn&apos;t on the list for
          this app. Centenarian Coach is a single-admin demo while the rough edges
          come off. Want to join the waitlist and hear when paid access opens?
        </p>
      ) : (
        <p className="mt-3 text-sm text-gray-700">
          Centenarian Coach is a single-admin demo while the rough edges come off.
          Leave your email and we&apos;ll let you know when paid access opens.
        </p>
      )}

      <WaitlistJoinForm />

      <p className="mt-8 text-sm text-gray-500">
        <Link href="/signin" className="underline hover:text-gray-700">
          Back to sign in
        </Link>
        {" · "}
        <Link href="/guide" className="underline hover:text-gray-700">
          Read the guide
        </Link>
      </p>
    </main>
  );
}
