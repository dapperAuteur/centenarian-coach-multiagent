// src/app/coach/history/page.tsx
// Review past coaching sessions, newest first. Server component — reads the
// DB directly. Admin-gated by middleware along with the rest of /coach/*.

import Link from "next/link";
import { listSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CoachHistoryPage() {
  const sessions = await listSessions(50);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Coaching history</h1>
          <p className="mt-1 text-sm text-gray-500">
            Past coaching sessions, most recent first. Select one to see how it
            was routed and what each specialist found.
          </p>
        </div>
        <Link
          href="/coach"
          className="shrink-0 text-xs text-sky-700 hover:underline"
        >
          ← Back to coach
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-10 rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No coaching sessions yet. Ask the coach a question and it will appear
          here.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/coach/history/${session.id}`}
                className="block rounded-md border border-gray-200 px-4 py-3 hover:border-sky-300 hover:bg-sky-50"
              >
                <p className="text-sm font-medium text-gray-900">
                  {session.query}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {dateFmt.format(session.createdAt)}
                  {session.consultedAgents.length > 0 && (
                    <> · {session.consultedAgents.join(", ")}</>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
