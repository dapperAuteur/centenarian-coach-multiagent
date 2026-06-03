// evals/run-langsmith.ts
// Hosted, dashboarded evals via the LangSmith JS SDK. Pushes evals/dataset.json
// to a LangSmith dataset and runs the SAME evaluators as the local `pnpm eval`
// gate (evals/rubric.ts) plus the LLM-judge grounding evaluator, producing a
// tracked experiment you can open, diff, and inspect run-by-run in LangSmith.
//
// This does NOT replace `pnpm eval` (tests/coach.eval.test.ts): that stays the
// dependency-free, CI-cheap regression gate. This is the opt-in, network-bound
// runner. Run it with `pnpm eval:langsmith` (needs LANGSMITH_API_KEY).
//
// It lives in evals/ as a .ts file (not .mjs) so the "@/" path alias resolves, // the package script runs it through tsx, which honors tsconfig paths.

import { fileURLToPath } from "node:url";
import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";
import { coachGraph } from "@/graph";
import type { Agent, CoachState } from "@/state";
import datasetJson from "./dataset.json";
import {
  routingScore,
  citationScore,
  type EvalExample,
  type EvalScore,
} from "./rubric";
import { groundingEvaluator } from "./grounding";

export const DATASET_NAME = "centenarian-coach";

/**
 * Push evals/dataset.json into a LangSmith dataset. Idempotent: if the dataset
 * already exists we return its id and leave it untouched (v1). Syncing newly
 * added examples into an existing dataset is the growing-dataset follow-up
 * taught in Module 4; keeping v1 skip-if-exists keeps the first run obvious.
 */
export async function pushDataset(
  client: Client = new Client(),
): Promise<string> {
  const examples = datasetJson as EvalExample[];
  if (await client.hasDataset({ datasetName: DATASET_NAME })) {
    const existing = await client.readDataset({ datasetName: DATASET_NAME });
    return existing.id;
  }
  const dataset = await client.createDataset(DATASET_NAME, {
    description: "Centenarian Coach routing + citation + grounding eval set.",
  });
  await client.createExamples({
    inputs: examples.map((example) => ({ question: example.question })),
    outputs: examples.map((example) => ({
      expectedAgents: example.expectedAgents,
    })),
    metadata: examples.map((example) => ({
      id: example.id,
      addedIn: example.addedIn ?? "module-3",
    })),
    datasetId: dataset.id,
  });
  return dataset.id;
}

/** evaluate() target: invoke the live coach graph and return the full state. */
async function runCoach(input: {
  question: string;
}): Promise<{ state: CoachState }> {
  const state = await coachGraph.invoke({
    sessionId: "langsmith-eval",
    userQuery: input.question,
  });
  return { state };
}

// The routing + citation evaluators wrap the SAME pure rubric functions from
// evals/rubric.ts, no scoring logic is duplicated here. (groundingEvaluator
// likewise wraps evals/grounding.ts.)
function routingEvaluator(args: {
  outputs: Record<string, unknown>;
  referenceOutputs?: Record<string, unknown>;
}): EvalScore {
  const state = args.outputs.state as CoachState;
  const expectedAgents = (args.referenceOutputs?.expectedAgents ?? []) as Agent[];
  return routingScore(state, { id: "", question: "", expectedAgents });
}

function citationEvaluator(args: {
  outputs: Record<string, unknown>;
}): EvalScore {
  return citationScore(args.outputs.state as CoachState);
}

/** Push the dataset, run evaluate() over the live graph, report the experiment. */
export async function runLangsmithEval() {
  await pushDataset();
  return evaluate(runCoach, {
    data: DATASET_NAME,
    evaluators: [routingEvaluator, citationEvaluator, groundingEvaluator],
    experimentPrefix: "coach-eval",
    maxConcurrency: 2, // gentle on free-tier LLM rate limits
    metadata: { provider: process.env.COACH_LLM_PROVIDER ?? "google" },
  });
}

// Auto-run only when executed directly (`tsx evals/run-langsmith.ts`), not when
// imported (e.g. by a test). Canonical Node ESM "is this the entry module" check.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLangsmithEval()
    .then(() => {
      console.log(
        "\nLangSmith experiment complete, open the printed experiment URL in the dashboard.",
      );
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
