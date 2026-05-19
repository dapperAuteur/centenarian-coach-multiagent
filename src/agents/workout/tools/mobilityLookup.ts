// src/agents/workout/tools/mobilityLookup.ts
// Workout specialist tool: mobility drills for a body area. Zod-schema'd.

import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const MOBILITY_AREAS = [
  "hips",
  "shoulders",
  "ankles",
  "thoracic_spine",
  "hamstrings",
  "wrists",
] as const;

export const MobilityInputSchema = z.object({
  area: z.enum(MOBILITY_AREAS),
});

export type MobilityInput = z.infer<typeof MobilityInputSchema>;

export interface MobilityResult {
  area: string;
  drills: string[];
}

const DRILLS: Record<MobilityInput["area"], string[]> = {
  hips: [
    "90/90 hip switches",
    "World's greatest stretch",
    "Deep squat hold with pry",
  ],
  shoulders: ["Band pull-aparts", "Wall slides", "Thread the needle"],
  ankles: [
    "Knee-to-wall ankle rocks",
    "Calf raises through a full range",
    "Banded ankle distractions",
  ],
  thoracic_spine: [
    "Cat-cow",
    "Open books (side-lying rotations)",
    "Foam-roller thoracic extensions",
  ],
  hamstrings: [
    "Jefferson curls",
    "Active straight-leg raises",
    "Toe-touch progressions",
  ],
  wrists: [
    "Wrist circles",
    "Quadruped wrist rocks",
    "Prayer and reverse-prayer stretch",
  ],
};

/** Pure lookup — exported for direct unit testing. */
export function lookupMobility(input: MobilityInput): MobilityResult {
  return { area: input.area, drills: DRILLS[input.area] };
}

export const mobilityLookup = tool(
  (input: MobilityInput): MobilityResult => lookupMobility(input),
  {
    name: "mobility_lookup",
    description:
      "Look up mobility drills for a body area: hips, shoulders, ankles, thoracic_spine, hamstrings, or wrists.",
    schema: MobilityInputSchema,
  },
);
