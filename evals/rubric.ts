// evals/rubric.ts
// Deterministic evaluators for the coach. Both are pure functions — no API,
// no network — so they unit-test cleanly (tests/evals.rubric.test.ts) and can
// gate CI without spending tokens. The eval runner (tests/coach.eval.test.ts)
// applies them across evals/dataset.json.

import type { Agent, CoachState } from "@/state";

export interface EvalExample {
  id: string;
  question: string;
  expectedAgents: Agent[];
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
