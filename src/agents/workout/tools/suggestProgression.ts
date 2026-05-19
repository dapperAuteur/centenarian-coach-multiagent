// src/agents/workout/tools/suggestProgression.ts
// Workout specialist tool: next-session load/reps via double progression.
// Every tool has a Zod schema.

import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const ProgressionInputSchema = z.object({
  exercise: z.string().min(1),
  // Inclusive .min() (not .positive()) — Gemini's structured-output schema
  // subset rejects the exclusiveMinimum keyword. 0 allows bodyweight work.
  currentWeightKg: z.number().min(0).max(1000),
  currentReps: z.number().int().min(1).max(100),
  goal: z.enum(["strength", "hypertrophy", "endurance"]),
});

export type ProgressionInput = z.infer<typeof ProgressionInputSchema>;

export interface ProgressionResult {
  nextWeightKg: number;
  nextReps: number;
  note: string;
}

const REP_CEILING: Record<ProgressionInput["goal"], number> = {
  strength: 6,
  hypertrophy: 12,
  endurance: 20,
};
const REP_FLOOR: Record<ProgressionInput["goal"], number> = {
  strength: 3,
  hypertrophy: 8,
  endurance: 15,
};

/** Pure double-progression computation — exported for direct unit testing. */
export function computeProgression(input: ProgressionInput): ProgressionResult {
  const ceiling = REP_CEILING[input.goal];
  const floor = REP_FLOOR[input.goal];
  const increment = input.goal === "endurance" ? 1 : 2.5;

  if (input.currentReps >= ceiling) {
    const nextWeightKg =
      Math.round((input.currentWeightKg + increment) * 10) / 10;
    return {
      nextWeightKg,
      nextReps: floor,
      note: `Hit the ${ceiling}-rep ceiling — add ${increment} kg and reset to ${floor} reps.`,
    };
  }
  return {
    nextWeightKg: input.currentWeightKg,
    nextReps: input.currentReps + 1,
    note: `Add one rep, working toward a ${ceiling}-rep ceiling before adding load.`,
  };
}

export const suggestProgression = tool(
  (input: ProgressionInput): ProgressionResult => computeProgression(input),
  {
    name: "suggest_progression",
    description:
      "Suggest next session's load and reps using double progression, from the current exercise, weight (kg), reps, and training goal.",
    schema: ProgressionInputSchema,
  },
);
