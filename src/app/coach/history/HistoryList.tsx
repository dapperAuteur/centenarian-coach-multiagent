"use client";

// src/app/coach/history/HistoryList.tsx
// Client-side searchable list of past coaching sessions. The page server
// component fetches the rows; this filters them as you type. Fuzzy on the
// question text (subsequence match), substring on the answer body.

import { useMemo, useState } from "react";
import Link from "next/link";

export interface HistoryItem {
  id: string;
  query: string;
  answerText: string | null;
  consultedAgents: string[];
  /** ISO string — Date is re-created here for formatting. */
  createdAt: string;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Case-insensitive subsequence match: every character of `needle` appears in
 * `haystack` in order. This is the usual "fuzzy finder" behavior — typing
 * "protein" matches, but so does "prtn".
 */
function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  let i = 0;
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) i += 1;
  }
  return i === n.length;
}

/** An item matches if the search fuzzy-matches its question, or appears as a
 * substring of its answer or consulted specialists. */
function matches(search: string, item: HistoryItem): boolean {
  const q = search.toLowerCase();
  return (
    fuzzyMatch(search, item.query) ||
    (item.answerText?.toLowerCase().includes(q) ?? false) ||
    item.consultedAgents.some((a) => a.toLowerCase().includes(q))
  );
}

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const [search, setSearch] = useState("");
  const query = search.trim();

  const filtered = useMemo(
    () => (query ? items.filter((item) => matches(query, item)) : items),
    [query, items],
  );

  if (items.length === 0) {
    return (
      <p className="mt-10 rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        No coaching sessions yet. Ask the coach a question and it will appear
        here.
      </p>
    );
  }

  return (
    <>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search past sessions…"
        className="mt-6 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      />

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No sessions match “{query}”.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={`/coach/history/${item.id}`}
                className="block rounded-md border border-gray-200 px-4 py-3 hover:border-sky-300 hover:bg-sky-50"
              >
                <p className="text-sm font-medium text-gray-900">
                  {item.query}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {dateFmt.format(new Date(item.createdAt))}
                  {item.consultedAgents.length > 0 && (
                    <> · {item.consultedAgents.join(", ")}</>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
