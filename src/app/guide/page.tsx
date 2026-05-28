// src/app/guide/page.tsx
// Public, searchable guide. Three audience sections (users, architecture,
// operators) rendered + filtered client-side; the five-lesson curriculum is
// rendered in-app at /guide/lessons/[slug]. Not behind the auth matcher.

import Link from "next/link";
import { GuideBrowser } from "./GuideBrowser";
import { GUIDE_SECTIONS } from "./guide-content";

export const metadata = {
  title: "Guide | Centenarian Coach Multi-Agent",
  description:
    "How to use and run the Centenarian Coach: asking the multi-agent coach, the architecture, and operating the science-based knowledge base (PDF ingest, embeddings, choosing LLMs).",
};

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs text-gray-500">
        <Link href="/" className="hover:underline">
          ← Home
        </Link>
      </p>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">Guide</h1>
      <p className="mt-2 text-sm text-gray-500">
        How to use the coach, how it is built, and how to run it yourself. The
        coach is grounded in a science-based fitness and nutrition curriculum.
        Search or filter by who you are.
      </p>

      <GuideBrowser sections={GUIDE_SECTIONS} />
    </main>
  );
}
