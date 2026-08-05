// src/app/admin/safety/page.tsx
// Admin safety report (BAM's safety-report requirement, plans/09 discussion):
// recent safety_events with per-trigger aggregates over the last 30 days,
// plus an on-demand LLM "improvement suggestions" report. Gated by
// middleware (matcher /admin/:path*) — only ADMIN_EMAIL reaches this route.

import Link from "next/link";
import { desc, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { safetyEvents } from "@/db/schema";
import {
  SAFETY_TRIGGERS,
  type SafetyTrigger,
} from "@/lib/safety-classifier";
import { SuggestionsPanel } from "./SuggestionsPanel";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Short human labels for the five trigger ids. */
const TRIGGER_LABELS: Record<SafetyTrigger, string> = {
  pain: "Pain",
  chronic_fatigue_overtraining: "Chronic fatigue / overtraining",
  restrictive_eating_intense_training: "Restrictive eating + training",
  aggressive_cutting_crash_diet: "Aggressive cutting / crash diet",
  severe_sleep_deprivation_high_load: "~4h sleep + high load",
};

function labelFor(trigger: string): string {
  return TRIGGER_LABELS[trigger as SafetyTrigger] ?? trigger;
}

export default async function AdminSafetyPage() {
  const [recent, last30] = await Promise.all([
    getDb()
      .select()
      .from(safetyEvents)
      .orderBy(desc(safetyEvents.createdAt))
      .limit(50),
    getDb()
      .select({
        triggers: safetyEvents.triggers,
        referralIncluded: safetyEvents.referralIncluded,
      })
      .from(safetyEvents)
      // Cutoff computed DB-side: Date.now() in render trips the
      // react-compiler purity lint in a server component.
      .where(gte(safetyEvents.createdAt, sql`now() - interval '30 days'`)),
  ]);

  // Aggregates over the last 30 days.
  const perTrigger: Record<SafetyTrigger, number> = Object.fromEntries(
    SAFETY_TRIGGERS.map((t) => [t, 0]),
  ) as Record<SafetyTrigger, number>;
  let withReferral = 0;
  for (const event of last30) {
    if (event.referralIncluded) withReferral += 1;
    for (const trigger of event.triggers) {
      if (trigger in perTrigger) perTrigger[trigger as SafetyTrigger] += 1;
    }
  }
  const referralPct =
    last30.length > 0 ? Math.round((withReferral / last30.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin · Safety</h1>
          <p className="mt-1 text-sm text-gray-500">
            Coach responses that tripped a safety trigger, for your review.
          </p>
        </div>
        <nav className="flex shrink-0 items-center gap-3 text-xs">
          <Link href="/admin" className="text-sky-700 hover:underline">
            Dashboard
          </Link>
          <Link href="/coach/history" className="text-sky-700 hover:underline">
            History
          </Link>
        </nav>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Last 30 days
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-2xl font-bold">{last30.length}</p>
            <p className="text-xs text-gray-500">safety events</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-2xl font-bold">{referralPct}%</p>
            <p className="text-xs text-gray-500">included a referral</p>
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Trigger</th>
                <th className="px-4 py-2">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SAFETY_TRIGGERS.map((trigger) => (
                <tr key={trigger}>
                  <td className="px-4 py-2 text-gray-800">
                    {TRIGGER_LABELS[trigger]}
                  </td>
                  <td className="px-4 py-2 font-mono text-gray-600">
                    {perTrigger[trigger]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Improvement suggestions
        </h2>
        <SuggestionsPanel />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Recent events
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {recent.length === 0
            ? "No safety events recorded yet."
            : `${recent.length} most recent.`}
        </p>

        {recent.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Triggers</th>
                  <th className="px-4 py-2">Referral</th>
                  <th className="px-4 py-2">Summary</th>
                  <th className="px-4 py-2">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 align-top">
                {recent.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50/60">
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                      <time dateTime={event.createdAt.toISOString()}>
                        {DATE_FMT.format(event.createdAt)}
                      </time>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {event.triggers.map((trigger) => (
                          <span
                            key={trigger}
                            className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700"
                          >
                            {labelFor(trigger)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {event.referralIncluded ? (
                        <span className="text-emerald-700">Yes</span>
                      ) : (
                        <span className="font-semibold text-rose-700">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-800">
                      <p>{event.summary}</p>
                      {event.userQueryExcerpt && (
                        <p className="mt-1 text-xs text-gray-400">
                          “{event.userQueryExcerpt}”
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Link
                        href={`/coach/history/${event.sessionId}`}
                        className="text-sky-700 hover:underline"
                      >
                        View ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
