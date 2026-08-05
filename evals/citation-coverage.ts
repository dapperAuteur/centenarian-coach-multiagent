// evals/citation-coverage.ts
// Canonical prompt for the LangSmith ONLINE citation-coverage evaluator
// (LLM-as-a-Judge on live traces). Ports the offline harness's Finding 1
// ("uncited specialist claims", plans/09) to production monitoring, the same
// way evals/grounding.ts backs the online grounding judge (plan 04 /
// user-task 23). Pure constants — no API, no network — so this file stays
// unit-test clean like evals/rubric.ts.
//
// KEEP IN SYNC (three expressions of one criterion — edit intent together):
//   1. src/agents/shared-rules.ts CITE_OR_DROP_RULE — the instruction given
//      to the specialists. Since the inline-citation upgrade (BAM's
//      2026-08-05 decision: inline markers AND the rubric, fixing the 66.7%
//      cx.no_uncited_claims traceability finding) the rule ALSO requires
//      claim-level inline [n] markers pointing at the numbered source list.
//      This judge prompt enforces the same rule from the outside: every
//      substantive recommendation must be traceable via its [n] marker(s)
//      to a supporting snippet; conversational framing is exempt; unmarked
//      substantive claims and wrong-source markers are the failure modes.
//   2. witus-agent-evals src/judge/rubrics/coach_multiagent.yaml
//      `cx.no_uncited_claims` — the OFFLINE harness rubric (judged by a
//      different model, per-specialist, against curated cases). The
//      orchestrator is updating that rubric to the marker format in step
//      with this change.
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
 * answer is traceable via its inline [n] marker(s) to a supporting
 * retrieved snippet; 0 = any is not. Deliberately pass/fail (unlike
 * grounding's 0..10 fraction): cite-or-drop is a discipline the answer
 * either keeps or breaks.
 */
export const CITATION_COVERAGE_JUDGE_PROMPT = `You are a strict citation-coverage judge for a health and longevity coach.

You receive the coach's run output as JSON. From it, extract:
- ANSWER   = output.finalAnswer.text
- SNIPPETS = every output.findings[*].citations[*].snippet (the retrieved
  sources the answer was built from). Number them 1, 2, 3, ... in pooled
  order: all of nutrition's citations first, then workout's, then
  recovery's, then corrective's (skipping absent specialists), preserving
  each list's own order. The ANSWER's inline markers refer to exactly this
  numbering.

Apply the coach's cite-or-drop rule, inline-marker form: every substantive
recommendation and factual claim in the ANSWER must carry one or more
inline markers like [2] or [1][3], and each cited SNIPPET must actually
support the specific claim the marker is attached to. Flag as violations:
- UNMARKED claims: substantive recommendations or factual claims with no
  [n] marker. Appended closing advice, motivational add-ons, and "also
  consider" suggestions are the classic case, no matter how sensible.
- WRONG-SOURCE markers: a marker whose numbered snippet does not support
  the claim it is attached to, or a marker number with no corresponding
  snippet. Check aptness per marker, not merely that some snippet
  somewhere agrees.
Conversational framing (greetings, transitions, restating the user's
situation), generic encouragement, hedging, and see-a-professional safety
referrals are exempt: they need no marker and must not affect the score.

Assign an INTEGER score: 1 only if EVERY substantive recommendation and
factual claim is traceable through its marker(s) to a supporting snippet;
0 if any is unmarked, mis-marked, or unsupported. Be conservative: if a
claim's cited snippet does not clearly back it, treat it as unsupported.
If there is no answer, or there are no snippets, score 0.

Give a short rationale: when scoring 0, quote the violating claim(s) and
name the failure kind (unmarked / wrong-source / unsupported); when
scoring 1, quote one representative claim with its marker.

Run output:
{{output}}`;
