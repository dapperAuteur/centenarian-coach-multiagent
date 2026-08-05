// evals/citation-coverage.ts
// Canonical prompt for the LangSmith ONLINE citation-coverage evaluator
// (LLM-as-a-Judge on live traces). Ports the offline harness's Finding 1
// ("uncited specialist claims", plans/09) to production monitoring, the same
// way evals/grounding.ts backs the online grounding judge (plan 04 /
// user-task 23). Pure constants — no API, no network — so this file stays
// unit-test clean like evals/rubric.ts.
//
// KEEP IN SYNC (three expressions of one criterion — edit intent together):
//   1. src/agents/shared-rules.ts CITE_OR_DROP_RULE (branch
//      feat/eval-prompt-fixes until merged) — the instruction given to the
//      specialists. This judge prompt enforces the same rule from the
//      outside: substantive recommendations must be supported by retrieved
//      sources; conversational framing is exempt; appended closing advice /
//      motivational add-ons / "also consider" suggestions are the known
//      failure mode.
//   2. witus-agent-evals src/judge/rubrics/coach_multiagent.yaml
//      `cx.no_uncited_claims` — the OFFLINE harness rubric (judged by a
//      different model, per-specialist, against curated cases).
//   3. This prompt — the ONLINE evaluator (judges the final synthesized
//      answer against the pooled citation snippets on sampled live traces).
//
// JUDGE-CONSISTENCY NOTE: online `citation_coverage` numbers are NOT
// comparable to the offline harness's `cx.no_uncited_claims` pass rate.
// Different judge models, different granularity (final answer vs
// per-specialist output), different inputs (live traffic vs curated cases).
// Track each line against itself only — watch its own trend, never compare
// the two lines to each other.

/**
 * Feedback key the online evaluator writes on each sampled run. In the
 * LangSmith UI the evaluator's criterion name becomes this key, so the
 * dashboard config (plans/user-tasks/26) must use exactly this string.
 */
export const CITATION_COVERAGE_FEEDBACK_KEY = "citation_coverage";

/**
 * Binary score: 1 = every substantive recommendation/claim in the final
 * answer is supported by at least one retrieved snippet; 0 = any is not.
 * Deliberately pass/fail (unlike grounding's 0..10 fraction): cite-or-drop
 * is a discipline the answer either keeps or breaks.
 */
export const CITATION_COVERAGE_JUDGE_PROMPT = `You are a strict citation-coverage judge for a health and longevity coach.

You receive the coach's run output as JSON. From it, extract:
- ANSWER   = output.finalAnswer.text
- SNIPPETS = every output.findings[*].citations[*].snippet (the retrieved
  sources the answer was supposedly built from)

Apply the coach's cite-or-drop rule: every substantive recommendation and
factual claim in the ANSWER must be supported by at least one SNIPPET.
Pay particular attention to appended closing advice, motivational add-ons,
and "also consider" suggestions that the snippets do not support — that is
the known failure mode, no matter how sensible the advice seems.
Conversational framing (greetings, transitions, restating the user's
situation), generic encouragement, and hedging are exempt: they need no
support and must not affect the score.

Assign an INTEGER score: 1 only if EVERY substantive recommendation and
factual claim is supported by at least one snippet; 0 if any is not. Be
conservative: if a claim is not clearly backed by a snippet, treat it as
unsupported. If there is no answer, or there are no snippets, score 0.

Give a short rationale: when scoring 0, quote the unsupported claim(s);
when scoring 1, quote one representative supported claim.

Run output:
{{output}}`;
