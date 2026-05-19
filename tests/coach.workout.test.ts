// tests/coach.workout.test.ts
// Day 2 acceptance test: the supervisor + Workout pair against 3 sample
// questions, asserting citations are non-empty. Pure-unit tests for the
// workout tools always run; the live suite is gated on API keys + a seeded
// workout_kb namespace.

import { describe, it, expect } from "vitest";
import { computeProgression } from "@/agents/workout/tools/suggestProgression";
import { lookupMobility } from "@/agents/workout/tools/mobilityLookup";
import { coachGraph } from "@/graph";

describe("suggestProgression (pure unit)", () => {
  it("adds load and resets reps once the rep ceiling is hit", () => {
    const result = computeProgression({
      exercise: "back squat",
      currentWeightKg: 100,
      currentReps: 6, // strength ceiling is 6
      goal: "strength",
    });
    expect(result.nextWeightKg).toBe(102.5);
    expect(result.nextReps).toBe(3); // strength floor
  });

  it("adds a rep when below the ceiling", () => {
    const result = computeProgression({
      exercise: "back squat",
      currentWeightKg: 100,
      currentReps: 4,
      goal: "strength",
    });
    expect(result.nextWeightKg).toBe(100);
    expect(result.nextReps).toBe(5);
  });

  it("uses a 1 kg increment for the endurance goal", () => {
    const result = computeProgression({
      exercise: "goblet squat",
      currentWeightKg: 20,
      currentReps: 20, // endurance ceiling is 20
      goal: "endurance",
    });
    expect(result.nextWeightKg).toBe(21);
    expect(result.nextReps).toBe(15);
  });
});

describe("mobilityLookup (pure unit)", () => {
  it("returns drills for a known body area", () => {
    const result = lookupMobility({ area: "hips" });
    expect(result.area).toBe("hips");
    expect(result.drills.length).toBeGreaterThan(0);
  });
});

const SAMPLE_QUESTIONS = [
  "How should I progress my back squat once I can complete every prescribed rep?",
  "How many strength training sessions per week should I do to get stronger?",
  "Why does mobility work matter for healthy aging?",
];

// Live tests are opt-in (RUN_LIVE_TESTS=1) so `pnpm test` stays fast, free,
// and free of provider rate limits. They also need the API keys present.
const runLive =
  process.env.RUN_LIVE_TESTS === "1" &&
  Boolean(process.env.ANTHROPIC_API_KEY) &&
  Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY);

describe.skipIf(!runLive)("supervisor + Workout (live)", () => {
  it.each(SAMPLE_QUESTIONS)(
    'routes to Workout and returns a cited finding: "%s"',
    async (question) => {
      const result = await coachGraph.invoke({
        sessionId: "test-session",
        userQuery: question,
      });

      expect(result.routing).toBeDefined();
      expect(result.routing?.agents).toContain("workout");

      const finding = result.findings.workout;
      expect(finding).toBeDefined();
      expect(finding?.agent).toBe("workout");
      expect((finding?.text ?? "").length).toBeGreaterThan(0);

      // Core acceptance assertion: citations are non-empty.
      expect((finding?.citations ?? []).length).toBeGreaterThan(0);
      for (const citation of finding?.citations ?? []) {
        expect(citation.source.length).toBeGreaterThan(0);
        expect(citation.snippet.length).toBeGreaterThan(0);
        expect(citation.agent).toBe("workout");
      }
    },
  );
});
