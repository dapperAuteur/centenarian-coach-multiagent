// evals/grounding.ts
// LLM-as-judge grounding evaluator. Deliberately kept OUT of evals/rubric.ts so
// that file stays pure (no API, no network) and unit-tests cleanly. The judge
// scores, 0..1, what fraction of the final answer's factual claims trace back
// to a retrieved snippet — the citation-grounding discipline a health/longevity
// coach must meet, where an ungrounded but fluent answer is a liability.
//
// Used two ways with one source of truth:
//   - the local runner (tests/coach.eval.test.ts, opt-in via RUN_GROUNDING=1)
//   - a LangSmith evaluator (evals/run-langsmith.ts)

import { z } from "zod";
import { withRoleFallback } from "@/lib/with-fallback";
import type { CoachState, SpecialistFinding } from "@/state";
import type { EvalScore } from "./rubric";

const GroundingSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Fraction of the answer's factual claims supported by at least one snippet. 1 = every claim is traceable; 0 = none are.",
    ),
  unsupportedClaims: z
    .array(z.string())
    .describe(
      "Claims in the answer that no snippet supports. Empty when fully grounded.",
    ),
});

const JUDGE_SYSTEM = `You are a strict grounding judge for a health and longevity coach. You are given SNIPPETS (the sources the answer was built from) and an ANSWER. For every factual claim in the ANSWER, decide whether at least one SNIPPET supports it. Compute score = supported_claims / total_claims (1.0 means every factual claim is supported). List every unsupported claim verbatim. Be conservative: if a claim is not clearly backed by a snippet, treat it as unsupported. Generic encouragement, hedging, and restating the user's question are not factual claims; ignore them.`;

/**
 * Score how well the coach's final answer is grounded in the snippets the
 * specialists retrieved. Returns 0 when there is no answer or nothing was
 * retrieved (nothing to ground against). Judge is pinned to temperature 0.
 */
export async function groundingScore(state: CoachState): Promise<EvalScore> {
  const answer = state.finalAnswer?.text ?? "";
  const snippets = Object.values(state.findings)
    .filter((finding): finding is SpecialistFinding => Boolean(finding))
    .flatMap((finding) =>
      finding.citations.map((c) => `[${c.source}] ${c.snippet}`),
    );

  if (!answer || snippets.length === 0) {
    return {
      key: "grounding",
      score: 0,
      comment: "no final answer, or no retrieved snippets to ground against",
    };
  }

  const judge = await withRoleFallback(
    { role: "synthesizer", temperature: 0, maxTokens: 1024 },
    (model) =>
      model.withStructuredOutput(GroundingSchema, { name: "judge_grounding" }),
  );

  const verdict = await judge.invoke([
    { role: "system", content: JUDGE_SYSTEM },
    {
      role: "user",
      content: `SNIPPETS:\n${snippets.join("\n")}\n\nANSWER:\n${answer}`,
    },
  ]);

  return {
    key: "grounding",
    score: verdict.score,
    comment:
      verdict.unsupportedClaims.length > 0
        ? `unsupported: ${verdict.unsupportedClaims.join("; ")}`
        : undefined,
  };
}

/**
 * LangSmith evaluator wrapper around groundingScore. The evaluate() target
 * returns `{ state }`, so we read the coach state off `outputs`. Async is
 * supported by the LangSmith evaluator union.
 */
export async function groundingEvaluator(args: {
  outputs: Record<string, unknown>;
}): Promise<EvalScore> {
  return groundingScore(args.outputs.state as CoachState);
}
