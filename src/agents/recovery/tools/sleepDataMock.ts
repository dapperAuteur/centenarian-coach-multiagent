// src/agents/recovery/tools/sleepDataMock.ts
// Recovery specialist tool: the user's recent sleep summary. Demo-mode
// fixture data — stands in for a real sleep-tracker integration. Every tool
// has a Zod schema.

import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const SleepDataInputSchema = z.object({
  // Inclusive .min()/.max() — Gemini's structured-output schema subset
  // rejects the exclusiveMinimum keyword that .positive() emits.
  nights: z.number().int().min(1).max(30),
});

export type SleepDataInput = z.infer<typeof SleepDataInputSchema>;

export interface SleepDataResult {
  nights: number;
  avgSleepHours: number;
  avgEfficiencyPct: number;
  bedtimeConsistencyMin: number;
}

/** Deterministic fixture sleep summary — exported for direct unit testing. */
export function getSleepData(input: SleepDataInput): SleepDataResult {
  return {
    nights: input.nights,
    avgSleepHours: 7.1,
    avgEfficiencyPct: 88,
    bedtimeConsistencyMin: 34,
  };
}

export const sleepDataMock = tool(
  (input: SleepDataInput): SleepDataResult => getSleepData(input),
  {
    name: "sleep_data_mock",
    description:
      "Return the user's recent sleep summary (average hours, sleep efficiency, bedtime consistency) over the last N nights. Demo fixture data.",
    schema: SleepDataInputSchema,
  },
);
