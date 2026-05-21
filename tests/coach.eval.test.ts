// tests/coach.eval.test.ts
// The eval runner. Opt-in via RUN_EVALS=1 (the full run is ~20 questions x
// several LLM calls each — slow, and rate-limited on Gemini's free tier, so
// it is never part of the default `pnpm test`). Run it with `pnpm eval`.
//
// It invokes the real coach graph over evals/dataset.json, applies the
// deterministic rubric (evals/rubric.ts), prints a per-question + summary
// table, and gates on mean routing accuracy and citation coverage.

import { describe, it, expect } from "vitest";
import datasetJson from "../evals/dataset.json";
import { routingScore, citationScore, type EvalExample } from "../evals/rubric";
import { coachGraph } from "@/graph";

const dataset = datasetJson as EvalExample[];

const runEvals =
  process.env.RUN_EVALS === "1" &&
  Boolean(process.env.ANTHROPIC_API_KEY) &&
  Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY);

describe.skipIf(!runEvals)("coach eval dataset", () => {
  it(
    "routes accurately and cites every finding across the dataset",
    async () => {
      let routingHits = 0;
      let citationHits = 0;

      for (const example of dataset) {
        const state = await coachGraph.invoke({
          sessionId: `eval-${example.id}`,
          userQuery: example.question,
        });
        const routing = routingScore(state, example);
        const citation = citationScore(state);
        routingHits += routing.score;
        citationHits += citation.score;
        const note = routing.comment ? `  (${routing.comment})` : "";
        console.log(
          `[${example.id}] routing=${routing.score} citations=${citation.score}${note}`,
        );
      }

      const routingAccuracy = routingHits / dataset.length;
      const citationCoverage = citationHits / dataset.length;
      console.log(
        `\nrouting accuracy:  ${(routingAccuracy * 100).toFixed(0)}% (${routingHits}/${dataset.length})` +
          `\ncitation coverage: ${(citationCoverage * 100).toFixed(0)}% (${citationHits}/${dataset.length})`,
      );

      expect(routingAccuracy).toBeGreaterThanOrEqual(0.8);
      expect(citationCoverage).toBeGreaterThanOrEqual(0.9);
    },
    20 * 60_000, // up to 20 minutes — the free-tier LLM is the bottleneck
  );
});
