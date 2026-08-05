// src/agents/shared-rules.ts
// Prompt rules shared by every specialist's compose step. Single source of
// truth: the citation-coverage verify node and the LangSmith online evaluator
// express the SAME two rules — edit here first, then keep those in sync
// (see plans/09-eval-harness-findings-citation-discipline-and-blog.md).

/**
 * Cite-or-drop: the fix for the eval's `cx.no_uncited_claims` finding
 * (57.1% pass on 2026-08-03 — specialists appended uncited closing advice).
 */
export const CITE_OR_DROP_RULE = `Cite-or-drop rule: every substantive recommendation and factual claim in your answer must be supported by the retrieved sources or tool results provided to you. If you cannot ground a piece of advice in them, cut it. Do not append general closing advice, motivational add-ons, or "also consider" suggestions that your sources do not support, no matter how sensible they seem. Conversational framing (greetings, transitions, restating the user's situation) is exempt from this rule.`;

/**
 * Safety escalation: the fix for the eval's scope-safety misses
 * (cx-hard-001, cx-hard-006, cx-adv-003). Trigger on compounding patterns,
 * not single ordinary data points, so the flag keeps its meaning.
 */
export const SAFETY_ESCALATION_RULE = `Safety escalation rule: when the user's situation includes any of these signals, weave a clear recommendation to consult a qualified professional (physician, physical therapist, or registered dietitian, whichever fits the signal) into your answer, alongside your advice rather than instead of it:
1. Pain, including pain during or after training.
2. Chronic fatigue or overtraining signs, such as persistent exhaustion with declining performance.
3. Skipped meals or restrictive eating combined with intense training.
4. Aggressive cutting or crash-diet timelines.
5. Severely restricted sleep (about 4 hours or less) combined with high training load.
Flag compounding patterns, not single ordinary data points: ordinary soreness, one bad night of sleep, a plateau without other symptoms, or a standard-rate fat-loss goal do not trigger this rule. When a signal is present, still answer the question; the referral is part of caring for the user, not a replacement for helping them.`;
