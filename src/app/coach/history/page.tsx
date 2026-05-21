// src/app/coach/history/page.tsx
// Review past coaching sessions, newest first. Server component — reads the
// DB directly, then hands the rows to a client component for live search.
// Admin-gated by middleware along with the rest of /coach/*.

import Link from "next/link";
import { listSessions } from "@/lib/sessions";
import { HistoryList } from "./HistoryList";

export const dynamic = "force-dynamic";

export default async function CoachHistoryPage() {
  const sessions = await listSessions(50);
  const items = sessions.map((session) => ({
    id: session.id,
    query: session.query,
    answerText: session.finalAnswerText,
    consultedAgents: session.consultedAgents,
    createdAt: session.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Coaching history</h1>
          <p className="mt-1 text-sm text-gray-500">
            Past coaching sessions, most recent first. Search by question or
            answer, then select one to see how it was routed.
          </p>
        </div>
        <Link
          href="/coach"
          className="shrink-0 text-xs text-sky-700 hover:underline"
        >
          ← Back to coach
        </Link>
      </div>

      <HistoryList items={items} />
    </main>
  );
}
