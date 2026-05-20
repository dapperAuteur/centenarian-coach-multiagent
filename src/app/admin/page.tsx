// src/app/admin/page.tsx
// Admin dashboard — a read-only view of the waitlist.
// Gated by middleware (matcher /admin/:path*) and the `authorized` /
// `signIn` callbacks: only ADMIN_EMAIL can reach this route. Managing
// waitlist entries (replying, archiving) lives in the WitUS Inbox.

import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { waitlist } from "@/db/schema";

// Always render fresh — waitlist rows arrive at any time.
export const dynamic = "force-dynamic";

const INBOX_URL =
  "https://inbox.witus.online/inbox?source=centenarian-coach-multiagent&form_type=waitlist-signup";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminPage() {
  const rows = await getDb()
    .select({
      id: waitlist.id,
      email: waitlist.email,
      createdAt: waitlist.createdAt,
    })
    .from(waitlist)
    .orderBy(desc(waitlist.createdAt));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin · Waitlist</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length === 0
              ? "No waitlist signups yet."
              : `${rows.length} ${rows.length === 1 ? "signup" : "signups"}.`}
          </p>
        </div>
        <a
          href="/api/auth/signout?callbackUrl=/"
          className="shrink-0 text-xs text-gray-500 hover:text-gray-800 hover:underline"
        >
          Sign out
        </a>
      </div>

      {rows.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2 font-mono text-gray-900">
                    {row.email}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    <time dateTime={row.createdAt.toISOString()}>
                      {DATE_FMT.format(row.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          No one has joined the waitlist yet. Submit a non-admin email at{" "}
          <Link href="/signin" className="underline hover:text-gray-900">
            /signin
          </Link>{" "}
          to test the flow.
        </div>
      )}

      <p className="mt-6 text-xs text-gray-500">
        Manage signups (reply, archive) in the central triage queue:{" "}
        <a
          href={INBOX_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700"
        >
          Open in WitUS Inbox ↗
        </a>
      </p>
    </main>
  );
}
