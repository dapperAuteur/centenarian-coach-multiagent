// src/agents/recovery/tools/hrvTrendMock.ts
// Recovery specialist tool: the user's heart-rate-variability trend. Demo-mode
// fixture data — stands in for a real wearable integration. Zod-schema'd.

import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const HrvTrendInputSchema = z.object({
  days: z.number().int().min(1).max(90),
});

export type HrvTrendInput = z.infer<typeof HrvTrendInputSchema>;

export type HrvTrendDirection = "rising" | "stable" | "falling";

export interface HrvTrendResult {
  days: number;
  avgHrvMs: number;
  baselineMs: number;
  trend: HrvTrendDirection;
}

/** Deterministic fixture HRV trend — exported for direct unit testing. */
export function getHrvTrend(input: HrvTrendInput): HrvTrendResult {
  return {
    days: input.days,
    avgHrvMs: 58,
    baselineMs: 62,
    trend: "falling",
  };
}

export const hrvTrendMock = tool(
  (input: HrvTrendInput): HrvTrendResult => getHrvTrend(input),
  {
    name: "hrv_trend_mock",
    description:
      "Return the user's heart-rate-variability trend over the last N days (average HRV in ms, personal baseline, and direction: rising, stable, or falling). Demo fixture data.",
    schema: HrvTrendInputSchema,
  },
);
