// src/app/sources/page.tsx
// Public bibliography: the open-access studies behind the coach, fuzzy-searchable
// and filterable by specialist. Data is the committed src/data/bibliography.json
// (extracted from the certification reference lists, filtered to open-access via
// Unpaywall). The "in corpus" badge cross-references the seeded coach_kb sources.

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import bibliographyData from "@/data/bibliography.json";
import { SourcesList, type Study } from "./SourcesList";

export const dynamic = "force-dynamic";

type RawStudy = Omit<Study, "inCorpus">;

/** Distinct `source` strings currently seeded in coach_kb (best-effort: returns
 * [] if the DB is unreachable, so the page still renders the bibliography). */
async function seededSources(): Promise<string[]> {
  try {
    const result: unknown = await getDb().execute(
      sql`SELECT DISTINCT source FROM coach_kb`,
    );
    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: unknown[] }).rows ?? []);
    return (rows as { source?: string }[]).map((r) =>
      (r.source ?? "").toLowerCase(),
    );
  } catch {
    return [];
  }
}

export default async function SourcesPage() {
  const seeded = await seededSources();
  const studies: Study[] = (bibliographyData as RawStudy[]).map((s) => ({
    ...s,
    inCorpus: seeded.some((src) => src.includes(s.doi.toLowerCase())),
  }));
  const inCorpusCount = studies.filter((s) => s.inCorpus).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Sources</h1>

      <p className="mt-4 text-sm leading-relaxed text-gray-600">
        The open-access, peer-reviewed studies behind Fit T. Cent, the kind of
        science that underpins leading science-based fitness and health
        certifications. Every study listed here is freely readable: tap a title
        for the open-access copy. An &ldquo;in the coach&rsquo;s corpus&rdquo;
        badge marks the studies the coach actually retrieves from
        {inCorpusCount > 0 ? ` (${inCorpusCount} so far)` : ""}.
      </p>

      <SourcesList studies={studies} />
    </main>
  );
}
