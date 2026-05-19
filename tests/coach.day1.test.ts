// tests/coach.day1.test.ts
// Day 1 acceptance test: the supervisor + Nutrition pair against 3 sample
// questions, asserting citations are non-empty.
//
// The live suite is gated on API keys + a seeded coach_kb. Without keys it
// skips cleanly. The pure-unit calorie test always runs. Prerequisites for the
// live suite:
//   1. apply src/db/migrations to the database
//   2. pnpm kb:seed
//   3. ANTHROPIC_API_KEY and GOOGLE_GEMINI_API_KEY set in .env.local

import { describe, it, expect } from "vitest";
import { computeCalories } from "@/agents/nutrition/tools/calorieCalculator";
import { coachGraph } from "@/graph";

describe("calorieCalculator (pure unit)", () => {
  it("computes Mifflin-St Jeor BMR and TDEE for a male", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const result = computeCalories({
      sex: "male",
      ageYears: 30,
      weightKg: 80,
      heightCm: 180,
      activityLevel: "moderate",
    });
    expect(result.bmr).toBe(1780);
    expect(result.maintenanceCalories).toBe(2759); // 1780 * 1.55
  });

  it("applies the female offset", () => {
    // 10*65 + 6.25*165 - 5*40 - 161 = 1320.25
    const result = computeCalories({
      sex: "female",
      ageYears: 40,
      weightKg: 65,
      heightCm: 165,
      activityLevel: "sedentary",
    });
    expect(result.bmr).toBe(1320);
  });
});

const SAMPLE_QUESTIONS = [
  "How much protein should a 70-year-old eat to preserve muscle mass?",
  "What kinds of foods help me sustain a moderate calorie deficit?",
  "Are there longevity benefits to time-restricted eating?",
];

// Live tests are opt-in (RUN_LIVE_TESTS=1) so `pnpm test` stays fast, free,
// and free of provider rate limits. They also need the API keys present.
const runLive =
  process.env.RUN_LIVE_TESTS === "1" &&
  Boolean(process.env.ANTHROPIC_API_KEY) &&
  Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY);

describe.skipIf(!runLive)("supervisor + Nutrition (live)", () => {
  it.each(SAMPLE_QUESTIONS)(
    'routes to Nutrition and returns a cited finding: "%s"',
    async (question) => {
      const result = await coachGraph.invoke({
        sessionId: "test-session",
        userQuery: question,
      });

      expect(result.routing).toBeDefined();
      expect(result.routing?.agents).toContain("nutrition");

      const finding = result.findings.nutrition;
      expect(finding).toBeDefined();
      expect(finding?.agent).toBe("nutrition");
      expect((finding?.text ?? "").length).toBeGreaterThan(0);

      // Core PRD assertion: citations are non-empty.
      expect((finding?.citations ?? []).length).toBeGreaterThan(0);
      for (const citation of finding?.citations ?? []) {
        expect(citation.source.length).toBeGreaterThan(0);
        expect(citation.snippet.length).toBeGreaterThan(0);
        expect(citation.agent).toBe("nutrition");
      }
    },
  );
});
