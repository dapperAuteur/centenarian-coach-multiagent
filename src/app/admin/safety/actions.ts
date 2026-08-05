"use server";

// Server action for the /admin/safety page: one LLM call over the recent
// safety events producing a short markdown improvement report for the admin.
// Admin-gated by middleware (matcher /admin/:path*) like the rest of /admin —
// server-action POSTs target the page's own URL, so the same gate applies.
//
// Privacy: only the stored one-sentence summaries, trigger lists, referral
// flags, and the ~200-char query excerpts are sent to the model — never full
// user queries or full coach answers.

import { z } from "zod";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { safetyEvents } from "@/db/schema";
import { withRoleFallback } from "@/lib/with-fallback";

const ReportSchema = z.object({
  report: z
    .string()
    .min(1)
    .describe("The full markdown report, ready to render."),
});

const REPORT_SYSTEM = `You are a user-safety analyst for a longevity-focused AI health coach. You receive a JSON list of recent safety events. Each event records which safety triggers fired in a user's message (pain, chronic fatigue/overtraining, restrictive eating + intense training, aggressive cutting/crash diets, ~4h sleep + high training load), whether the coach's answer included a professional-referral recommendation, a one-sentence summary, and a short excerpt of the user's question.

Write a concise markdown report for the app's administrator with exactly these sections:

## Patterns observed
## Missed referrals
## Suggestions to improve user safety

In "Missed referrals", focus on events where a trigger fired but no professional referral was included. In "Suggestions", give concrete, actionable prompt or product changes (e.g. wording for the coach's system prompts, UI affordances, escalation rules). Keep the whole report under ~400 words. Do not invent events that are not in the data.`;

export interface SafetySuggestionsResult {
  report: string | null;
  error: string | null;
}

/**
 * Generate an improvement-suggestions report over the ~50 most recent
 * safety events. Returns the markdown (rendered client-side); nothing is
 * persisted in v1.
 */
export async function generateSafetySuggestions(): Promise<SafetySuggestionsResult> {
  try {
    const events = await getDb()
      .select({
        createdAt: safetyEvents.createdAt,
        triggers: safetyEvents.triggers,
        referralIncluded: safetyEvents.referralIncluded,
        summary: safetyEvents.summary,
        userQueryExcerpt: safetyEvents.userQueryExcerpt,
      })
      .from(safetyEvents)
      .orderBy(desc(safetyEvents.createdAt))
      .limit(50);

    if (events.length === 0) {
      return {
        report: null,
        error: "No safety events recorded yet — nothing to analyze.",
      };
    }

    const model = await withRoleFallback(
      { role: "composer", temperature: 0 },
      (m) =>
        m.withStructuredOutput(ReportSchema, {
          name: "safety_improvement_report",
        }),
    );
    const { report } = await model.invoke([
      { role: "system", content: REPORT_SYSTEM },
      {
        role: "user",
        content: `Recent safety events (newest first):\n${JSON.stringify(
          events.map((e) => ({
            date: e.createdAt.toISOString().slice(0, 10),
            triggers: e.triggers,
            referralIncluded: e.referralIncluded,
            summary: e.summary,
            queryExcerpt: e.userQueryExcerpt,
          })),
          null,
          2,
        )}`,
      },
    ]);
    return { report, error: null };
  } catch (err) {
    console.error("[admin/safety] suggestions generation failed:", err);
    return {
      report: null,
      error:
        err instanceof Error ? err.message : "Failed to generate suggestions.",
    };
  }
}
