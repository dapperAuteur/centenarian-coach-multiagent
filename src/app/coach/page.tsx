"use client";

// src/app/coach/page.tsx
// The coach UI: ask a question, watch the supervisor route it, see each
// specialist report in, then read the synthesized answer with citations.
// Functional, not pretty (PRD §10).

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type {
  Agent,
  Citation,
  FinalAnswer,
  RoutingDecision,
  SpecialistFinding,
} from "@/state";

interface StreamEvent {
  type: "session" | "routing" | "finding" | "answer" | "done" | "error";
  sessionId?: string;
  routing?: RoutingDecision;
  finding?: SpecialistFinding;
  finalAnswer?: FinalAnswer;
  message?: string;
}

// Specialists with an implemented node (recovery is v2).
const IMPLEMENTED: Agent[] = ["nutrition", "workout"];

export default function CoachPage() {
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [routing, setRouting] = useState<RoutingDecision | null>(null);
  const [findings, setFindings] = useState<SpecialistFinding[]>([]);
  const [answer, setAnswer] = useState<FinalAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCitations, setShowCitations] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const userQuery = query.trim();
    if (!userQuery || running) return;

    setRunning(true);
    setRouting(null);
    setFindings([]);
    setAnswer(null);
    setError(null);
    setShowCitations(false);

    try {
      const res = await fetch("/api/coach/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userQuery }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "routing" && event.routing) {
            setRouting(event.routing);
          } else if (event.type === "finding" && event.finding) {
            const finding = event.finding;
            setFindings((prev) => [...prev, finding]);
          } else if (event.type === "answer" && event.finalAnswer) {
            setAnswer(event.finalAnswer);
          } else if (event.type === "error") {
            setError(event.message ?? "Unknown error");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  const consulted = (routing?.agents ?? []).filter((a) =>
    IMPLEMENTED.includes(a),
  );
  const findingFor = (agent: Agent) =>
    findings.find((f) => f.agent === agent);
  const allFindingsIn =
    consulted.length > 0 && consulted.every((a) => Boolean(findingFor(a)));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Centenarian Coach</h1>
      <p className="mt-1 text-sm text-gray-500">
        A multi-agent coach — a supervisor routes your question to nutrition and
        workout specialists, each with its own retrieval and tools.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. I slept 6 hours — should I still train legs today?"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          disabled={running}
        />
        <Button type="submit" disabled={running || !query.trim()}>
          {running ? "Asking…" : "Ask"}
        </Button>
      </form>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {routing && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Routing
          </h2>
          <p className="mt-1 text-sm text-gray-700">{routing.rationale}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {consulted.map((agent) => (
              <li key={agent} className="flex items-center gap-2">
                <span aria-hidden>{findingFor(agent) ? "✓" : "⏳"}</span>
                <span className="capitalize">
                  {findingFor(agent)
                    ? `${agent} specialist reported`
                    : `Consulting ${agent} specialist…`}
                </span>
                {findingFor(agent) && (
                  <span className="text-xs text-gray-400">
                    {findingFor(agent)?.durationMs}ms
                  </span>
                )}
              </li>
            ))}
            {allFindingsIn && (
              <li className="flex items-center gap-2">
                <span aria-hidden>{answer ? "✓" : "⏳"}</span>
                <span>
                  {answer ? "Answer synthesized" : "Synthesizing answer…"}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}

      {answer && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Answer
          </h2>
          {answer.text.split("\n").filter(Boolean).map((para, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-gray-900">
              {para}
            </p>
          ))}
          <p className="mt-3 text-xs text-gray-400">
            Consulted: {answer.consultedAgents.join(", ") || "none"}
          </p>

          {answer.citations.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowCitations((s) => !s)}
                className="text-sm font-medium text-sky-700 hover:underline"
              >
                {showCitations ? "Hide" : "Show"} citations (
                {answer.citations.length})
              </button>
              {showCitations && <CitationList citations={answer.citations} />}
            </div>
          )}

          <a
            href="https://smith.langchain.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-gray-500 hover:underline"
          >
            Open in LangSmith ↗
          </a>
        </section>
      )}
    </main>
  );
}

function CitationList({ citations }: { citations: Citation[] }) {
  const byAgent = new Map<Agent, Citation[]>();
  for (const c of citations) {
    const list = byAgent.get(c.agent) ?? [];
    list.push(c);
    byAgent.set(c.agent, list);
  }
  return (
    <div className="mt-2 space-y-3">
      {[...byAgent.entries()].map(([agent, list]) => (
        <div key={agent}>
          <p className="text-xs font-semibold capitalize text-gray-600">
            {agent}
          </p>
          <ul className="mt-1 space-y-1">
            {list.map((c, i) => (
              <li
                key={`${agent}-${i}`}
                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
              >
                <span className="font-medium">{c.source}</span>
                <span className="text-gray-500"> — {c.snippet}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
