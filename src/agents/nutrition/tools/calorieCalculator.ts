// src/agents/nutrition/tools/calorieCalculator.ts
// Nutrition specialist tool: BMR + maintenance calories via the
// Mifflin-St Jeor equation. Every tool has a Zod schema.

import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const CalorieInputSchema = z.object({
  sex: z.enum(["male", "female"]),
  ageYears: z.number().int().min(1).max(120),
  // Inclusive .min() (not .positive()) — Gemini's structured-output schema
  // subset rejects the `exclusiveMinimum` keyword that .positive() emits.
  weightKg: z.number().min(1).max(400),
  heightCm: z.number().min(1).max(260),
  activityLevel: z.enum([
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ]),
});

export type CalorieInput = z.infer<typeof CalorieInputSchema>;

export interface CalorieResult {
  bmr: number;
  maintenanceCalories: number;
  activityMultiplier: number;
}

const ACTIVITY_MULTIPLIER: Record<CalorieInput["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Pure Mifflin-St Jeor computation — exported for direct unit testing. */
export function computeCalories(input: CalorieInput): CalorieResult {
  // BMR = 10*kg + 6.25*cm - 5*age + s, where s = +5 (male) / -161 (female).
  const sexOffset = input.sex === "male" ? 5 : -161;
  const bmr =
    10 * input.weightKg +
    6.25 * input.heightCm -
    5 * input.ageYears +
    sexOffset;
  const activityMultiplier = ACTIVITY_MULTIPLIER[input.activityLevel];
  return {
    bmr: Math.round(bmr),
    maintenanceCalories: Math.round(bmr * activityMultiplier),
    activityMultiplier,
  };
}

export const calorieCalculator = tool(
  (input: CalorieInput): CalorieResult => computeCalories(input),
  {
    name: "calorie_calculator",
    description:
      "Compute BMR (Mifflin-St Jeor) and maintenance calories (TDEE) from sex, age (years), weight (kg), height (cm), and activity level.",
    schema: CalorieInputSchema,
  },
);
