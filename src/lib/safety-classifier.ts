// src/lib/safety-classifier.ts
// Post-response safety classification. After the coach produces a final
// answer, one structured-output LLM call decides whether the exchange
// tripped any of the five BAM-approved safety triggers, and if so writes a
// safety_events row for admin review at /admin/safety.
//
// Contract with the request path: NEVER throw. A classifier or DB failure is
// logged loudly and swallowed — the user already has their answer, and
// safety telemetry must not break the product. No triggers → no row.
//
// The five triggers below duplicate the SAFETY_ESCALATION_RULE wording in
// src/agents/shared-rules.ts on the sibling branch feat/eval-prompt-fixes
// (not importable from this branch's base). Keep the two lists aligned when
// the bundle merges.

import { z } from "zod";
import { getDb } from "@/lib/db";
import { safetyEvents } from "@/db/schema";
import { withRoleFallback } from "@/lib/with-fallback";

/** Stable ids for the five BAM-approved safety triggers. */
export const SAFETY_TRIGGERS = [
  "pain",
  "chronic_fatigue_overtraining",
  "restrictive_eating_intense_training",
  "aggressive_cutting_crash_diet",
  "severe_sleep_deprivation_high_load",
] as const;

export type SafetyTrigger = (typeof SAFETY_TRIGGERS)[number];

export const SafetyClassificationSchema = z.object({
  triggers: z
    .array(z.enum(SAFETY_TRIGGERS))
    .describe(
      "Every safety trigger present in the user's message. Empty when none apply.",
    ),
  referralIncluded: z
    .boolean()
    .describe(
      "true only if the coach's final answer recommends consulting a professional (doctor, physical therapist, registered dietitian, etc.).",
    ),
  summary: z
    .string()
    .max(300)
    .describe(
      "One sentence describing what safety concern was (or was not) observed.",
    ),
});

export type SafetyClassification = z.infer<typeof SafetyClassificationSchema>;

// Keep wording aligned with SAFETY_ESCALATION_RULE in
// src/agents/shared-rules.ts (sibling branch feat/eval-prompt-fixes).
const SAFETY_CLASSIFIER_SYSTEM = `You audit a health-coach exchange for user-safety escalation triggers. You are given the user's question and the coach's final answer.

Report which of these five triggers are present in the USER'S message:
1. pain — the user mentions pain of any kind, including pain during or after training.
2. chronic_fatigue_overtraining — the user describes chronic fatigue or signs of overtraining.
3. restrictive_eating_intense_training — the user describes skipped meals or restrictive eating combined with intense training.
4. aggressive_cutting_crash_diet — the user describes aggressive cutting, crash dieting, or extreme caloric restriction.
5. severe_sleep_deprivation_high_load — the user describes very short sleep (around 4 hours or less) combined with a high training load.

Only report a trigger when the user's own message contains it — do not infer triggers from the coach's answer. Also report whether the coach's ANSWER includes a professional-referral recommendation (see a doctor, physical therapist, registered dietitian, or similar). Return an empty triggers array when none apply. Keep summary to one sentence.`;

export interface ClassifySafetyArgs {
  /** coach_sessions.id of the persisted run this event belongs to. */
  sessionId: string;
  userQuery: string;
  finalAnswerText: string;
}

/**
 * Run the safety classifier over one completed exchange. Exported separately
 * from the persistence wrapper so tests can exercise the prompt wiring.
 */
export async function classifySafety(
  args: Pick<ClassifySafetyArgs, "userQuery" | "finalAnswerText">,
): Promise<SafetyClassification> {
  const classifier = await withRoleFallback(
    { role: "composer", temperature: 0 },
    (m) =>
      m.withStructuredOutput(SafetyClassificationSchema, {
        name: "classify_safety",
      }),
  );
  const raw = await classifier.invoke([
    { role: "system", content: SAFETY_CLASSIFIER_SYSTEM },
    {
      role: "user",
      content: `User question:\n${args.userQuery}\n\nCoach final answer:\n${args.finalAnswerText}`,
    },
  ]);
  // Dedupe triggers; a model may repeat an enum member.
  return { ...raw, triggers: [...new Set(raw.triggers)] };
}

/**
 * Classify one exchange and persist a safety_events row when at least one
 * trigger fired. Never throws — errors are logged and swallowed so the
 * request path that calls this (best-effort, after the answer is already
 * streamed) can never fail because of safety telemetry.
 */
export async function recordSafetyEvent(
  args: ClassifySafetyArgs,
): Promise<void> {
  try {
    const classification = await classifySafety(args);
    if (classification.triggers.length === 0) return;

    await getDb().insert(safetyEvents).values({
      sessionId: args.sessionId,
      triggers: classification.triggers,
      referralIncluded: classification.referralIncluded,
      summary: classification.summary,
      userQueryExcerpt: args.userQuery.slice(0, 200),
    });
  } catch (err) {
    // Loud but non-fatal: safety telemetry must never break a user request.
    console.error(
      `[safety-classifier] failed for session ${args.sessionId}:`,
      err,
    );
  }
}
