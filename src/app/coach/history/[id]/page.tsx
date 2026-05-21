// src/app/coach/history/[id]/page.tsx
// A single past coaching session: how it was routed, what each specialist
// found (with citations and tool calls), and the synthesized answer. Server
// component — reads the DB directly. Admin-gated by middleware.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, type SpecialistCallRow } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function CoachHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/coach/history"
        className="text-xs text-sky-700 hover:underline"
      >
        ← All sessions
      </Link>

      <h1 className="mt-3 text-2xl font-bold">{session.query}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {dateFmt.format(session.createdAt)}
      </p>

      {session.routing && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Routing
          </h2>
          <p className="mt-1 text-sm text-gray-700">
            {session.routing.rationale}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Consulted: {session.routing.agents.join(", ") || "none"}
          </p>
        </section>
      )}

      {session.calls.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Specialist findings
          </h2>
          <div className="mt-2 space-y-4">
            {session.calls.map((call) => (
              <SpecialistCall key={call.id} call={call} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Answer
        </h2>
        {session.finalAnswerText ? (
          session.finalAnswerText
            .split("\n")
            .filter(Boolean)
            .map((para, i) => (
              <p
                key={i}
                className="mt-2 text-sm leading-relaxed text-gray-900"
              >
                {para}
              </p>
            ))
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            No answer was recorded for this session.
          </p>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Consulted: {session.consultedAgents.join(", ") || "none"}
        </p>
      </section>

      {session.langsmithRunId && (
        <p className="mt-6 text-xs text-gray-500">
          LangSmith run{" "}
          <span className="font-mono text-gray-600">
            {session.langsmithRunId}
          </span>
        </p>
      )}
    </main>
  );
}

function SpecialistCall({ call }: { call: SpecialistCallRow }) {
  return (
    <div className="rounded-md border border-gray-200 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold capitalize text-gray-900">
          {call.agentName}
        </p>
        <span className="text-xs text-gray-400">{call.durationMs}ms</span>
      </div>
      {call.subQuestion && (
        <p className="mt-1 text-xs italic text-gray-500">
          {call.subQuestion}
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-gray-800">
        {call.findingText}
      </p>

      {call.citations.length > 0 && (
        <ul className="mt-2 space-y-1">
          {call.citations.map((citation, i) => (
            <li
              key={i}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
            >
              <span className="font-medium">{citation.source}</span>
              <span className="text-gray-500">: {citation.snippet}</span>
            </li>
          ))}
        </ul>
      )}

      {call.toolCalls.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Tools: {call.toolCalls.map((t) => t.name).join(", ")}
        </p>
      )}
    </div>
  );
}
