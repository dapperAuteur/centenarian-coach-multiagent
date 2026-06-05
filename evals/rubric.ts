// evals/rubric.ts
// Deterministic evaluators for the coach. Both are pure functions, no API,
// no network, so they unit-test cleanly (tests/evals.rubric.test.ts) and can
// gate CI without spending tokens. The eval runner (tests/coach.eval.test.ts)
// applies them across evals/dataset.json.

import type { Agent, CoachState } from "@/state";

export interface EvalExample {
  id: string;
  question: string;
  expectedAgents: Agent[];
  /**
   * The module/lesson that introduced this example (e.g. "module-4"). Optional:
   * the original baseline set is bare; every example added later as the course
   * finds bugs carries provenance, so the dataset's growth is legible. This is
   * the "growing dataset" convention taught in Module 4.
   */
  addedIn?: string;
  /** Why this example exists, typically the bug/regression it pins. */
  note?: string;
}

export interface EvalScore {
  key: string;
  /** 0 or 1. */
  score: number;
  /** Why it failed, when it failed. */
  comment?: string;
}

/** 1 when the supervisor routed to exactly the expected specialist set. */
export function routingScore(
  state: CoachState,
  example: EvalExample,
): EvalScore {
  const got = [...(state.routing?.agents ?? [])].sort();
  const want = [...example.expectedAgents].sort();
  const correct =
    got.length === want.length && got.every((agent, i) => agent === want[i]);
  return {
    key: "routing_correct",
    score: correct ? 1 : 0,
    comment: correct
      ? undefined
      : `expected [${want.join(", ")}], got [${got.join(", ")}]`,
  };
}

/**
 * Phrases a specialist or the synthesizer uses to punt when retrieval came back
 * empty or off-topic ("the sources provided do not contain..."). A grounded
 * coach should not produce these when the corpus actually covers the question;
 * see the fall-prevention retrieval bug.
 */
const REFUSAL_RE =
  /not able to (locate|find)|do not contain|does not contain|no (relevant )?sources|could not find/i;

/**
 * 1 when retrieval was productive: every present specialist finding has at least
 * one citation AND the final answer does not read as a "no sources" refusal.
 * 0 flags the silent failure where the coach declines despite a corpus that
 * covers the topic. Deterministic, so it works as a cheap online evaluator too.
 */
export function emptyRetrievalScore(state: CoachState): EvalScore {
  const findings = Object.values(state.findings).filter(
    (finding): finding is NonNullable<typeof finding> => Boolean(finding),
  );
  const anyFindingEmpty = findings.some(
    (finding) => finding.citations.length === 0,
  );
  const answerRefuses = REFUSAL_RE.test(state.finalAnswer?.text ?? "");
  const ok = findings.length > 0 && !anyFindingEmpty && !answerRefuses;
  return {
    key: "no_empty_retrieval",
    score: ok ? 1 : 0,
    comment: ok
      ? undefined
      : anyFindingEmpty
        ? "a specialist returned zero sources"
        : answerRefuses
          ? "the answer reads as a no-sources refusal"
          : "no specialist findings were produced",
  };
}

/** 1 when every produced specialist finding carries at least one citation
 * and the synthesized final answer has citations. */
export function citationScore(state: CoachState): EvalScore {
  const findings = Object.values(state.findings).filter(
    (finding): finding is NonNullable<typeof finding> => Boolean(finding),
  );
  const everyFindingCited =
    findings.length > 0 &&
    findings.every((finding) => finding.citations.length > 0);
  const answerCited = (state.finalAnswer?.citations.length ?? 0) > 0;
  const ok = everyFindingCited && answerCited;
  return {
    key: "citations_present",
    score: ok ? 1 : 0,
    comment: ok
      ? undefined
      : "a specialist finding or the final answer had no citation",
  };
}
