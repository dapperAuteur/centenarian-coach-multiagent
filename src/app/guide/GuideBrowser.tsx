"use client";

// src/app/guide/GuideBrowser.tsx
// Client-side searchable/filterable view of the guide sections. Search is
// fuzzy (subsequence) on the section title and substring on the full section
// text — the same approach proven in coach/history/HistoryList.tsx. Audience
// chips narrow to one of the three reader groups.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AUDIENCE_LABELS,
  sectionSearchText,
  type Audience,
  type Block,
  type GuideSection,
} from "./guide-content";

/** Case-insensitive subsequence match: chars of `needle` appear in order. */
function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  let i = 0;
  for (let j = 0; j < h.length && i < n.length; j += 1) {
    if (h[j] === n[i]) i += 1;
  }
  return i === n.length;
}

const AUDIENCE_ORDER: Audience[] = ["users", "architecture", "operators"];

export function GuideBrowser({ sections }: { sections: GuideSection[] }) {
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<Audience | "all">("all");
  const query = search.trim();

  const filtered = useMemo(() => {
    return sections.filter((section) => {
      if (audience !== "all" && section.audience !== audience) return false;
      if (!query) return true;
      return (
        fuzzyMatch(query, section.title) ||
        sectionSearchText(section).includes(query.toLowerCase())
      );
    });
  }, [sections, audience, query]);

  return (
    <div className="mt-8">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search the guide (e.g. ollama, citations, seed, models)…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip
          label="All"
          active={audience === "all"}
          onClick={() => setAudience("all")}
        />
        {AUDIENCE_ORDER.map((a) => (
          <Chip
            key={a}
            label={AUDIENCE_LABELS[a]}
            active={audience === a}
            onClick={() => setAudience(a)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Nothing matches “{query}”.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {filtered.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                {AUDIENCE_LABELS[section.audience]}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3">
                {section.blocks.map((block, i) => (
                  <BlockView key={i} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white"
          : "rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      }
    >
      {label}
    </button>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-sm leading-relaxed text-gray-800">{block.text}</p>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-800">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-md bg-gray-900 px-4 py-3 text-xs leading-relaxed text-gray-100">
          <code>{block.code}</code>
        </pre>
      );
    case "link":
      return block.external ? (
        <a
          href={block.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          {block.label} ↗
        </a>
      ) : (
        <Link
          href={block.href}
          className="inline-block text-sm font-medium text-sky-700 hover:underline"
        >
          {block.label} →
        </Link>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}
