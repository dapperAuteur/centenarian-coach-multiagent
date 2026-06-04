"use client";

// src/app/sources/SourcesList.tsx
// Client-side searchable list of the open-access studies behind the coach.
// Fuzzy (subsequence) match on title + journal; filter by agent. The page
// server component supplies the data and the in-corpus flags.

import { useMemo, useState } from "react";

export interface Study {
  doi: string;
  title: string;
  journal: string | null;
  year: number | null;
  url: string;
  agents: string[];
  /** True when this study is seeded into the coach's knowledge base. */
  inCorpus: boolean;
}

const AGENTS = ["nutrition", "workout", "recovery", "corrective", "general"] as const;

/** Case-insensitive subsequence match (typing "protein" or "prtn" both match). */
function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  let i = 0;
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) i += 1;
  }
  return i === n.length;
}

function matches(search: string, s: Study): boolean {
  const q = search.toLowerCase();
  return (
    fuzzyMatch(search, s.title) ||
    (s.journal?.toLowerCase().includes(q) ?? false) ||
    s.doi.toLowerCase().includes(q)
  );
}

export function SourcesList({ studies }: { studies: Study[] }) {
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState<string | null>(null);
  const query = search.trim();

  const filtered = useMemo(
    () =>
      studies.filter(
        (s) =>
          (!agent || s.agents.includes(agent)) &&
          (!query || matches(query, s)),
      ),
    [studies, query, agent],
  );

  return (
    <>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search studies by title, journal, or DOI…"
        className="mt-6 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      />

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setAgent(null)}
          className={`rounded-full border px-3 py-1 ${agent === null ? "border-sky-500 bg-sky-50 text-sky-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
        >
          All ({studies.length})
        </button>
        {AGENTS.map((a) => {
          const count = studies.filter((s) => s.agents.includes(a)).length;
          if (count === 0) return null;
          return (
            <button
              key={a}
              type="button"
              onClick={() => setAgent(a === agent ? null : a)}
              className={`rounded-full border px-3 py-1 capitalize ${agent === a ? "border-sky-500 bg-sky-50 text-sky-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {a} ({count})
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        {filtered.length} {filtered.length === 1 ? "study" : "studies"}
        {query && ` matching “${query}”`}
        {agent && ` in ${agent}`}.
      </p>

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No studies match. Try a shorter search or a different filter.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {filtered.map((s) => (
            <li
              key={s.doi}
              className="rounded-md border border-gray-200 px-4 py-3"
            >
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-sky-700 hover:underline"
              >
                {s.title}
              </a>
              <p className="mt-1 text-xs text-gray-500">
                {[s.journal, s.year].filter(Boolean).join(", ")}
                {" · "}
                <a
                  href={`https://doi.org/${s.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {s.doi}
                </a>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                {s.agents.map((a) => (
                  <span
                    key={a}
                    className="rounded bg-gray-100 px-1.5 py-0.5 capitalize text-gray-600"
                  >
                    {a}
                  </span>
                ))}
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                  open access
                </span>
                {s.inCorpus && (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700">
                    in the coach&rsquo;s corpus
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
