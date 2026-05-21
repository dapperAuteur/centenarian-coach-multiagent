// tests/coach.recovery.test.ts
// v2 acceptance test: the supervisor + Recovery pair against 3 sample
// questions, asserting citations are non-empty. Pure-unit tests for the
// recovery mock tools always run; the live suite is gated on API keys + a
// seeded recovery_kb namespace.

import { describe, it, expect } from "vitest";
import { getSleepData } from "@/agents/recovery/tools/sleepDataMock";
import { getHrvTrend } from "@/agents/recovery/tools/hrvTrendMock";
import { coachGraph } from "@/graph";

describe("sleepDataMock (pure unit)", () => {
  it("returns a fixture sleep summary for the requested window", () => {
    const result = getSleepData({ nights: 7 });
    expect(result.nights).toBe(7);
    expect(result.avgSleepHours).toBeGreaterThan(0);
    expect(result.avgEfficiencyPct).toBeGreaterThan(0);
  });
});

describe("hrvTrendMock (pure unit)", () => {
  it("returns a fixture HRV trend for the requested window", () => {
    const result = getHrvTrend({ days: 14 });
    expect(result.days).toBe(14);
    expect(result.avgHrvMs).toBeGreaterThan(0);
    expect(["rising", "stable", "falling"]).toContain(result.trend);
  });
});

const SAMPLE_QUESTIONS = [
  "I have been sleeping badly this week. How much sleep do I actually need to recover?",
  "Should I take a rest day or train through the fatigue?",
  "My HRV has been trending below my baseline. What does that mean for my training?",
];

// Live tests are opt-in (RUN_LIVE_TESTS=1) so `pnpm test` stays fast, free,
// and free of provider rate limits. They also need the API keys present.
const runLive =
  process.env.RUN_LIVE_TESTS === "1" &&
  Boolean(process.env.ANTHROPIC_API_KEY) &&
  Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY);

describe.skipIf(!runLive)("supervisor + Recovery (live)", () => {
  it.each(SAMPLE_QUESTIONS)(
    'routes to Recovery and returns a cited finding: "%s"',
    async (question) => {
      const result = await coachGraph.invoke({
        sessionId: "test-session",
        userQuery: question,
      });

      expect(result.routing).toBeDefined();
      expect(result.routing?.agents).toContain("recovery");

      const finding = result.findings.recovery;
      expect(finding).toBeDefined();
      expect(finding?.agent).toBe("recovery");
      expect((finding?.text ?? "").length).toBeGreaterThan(0);

      // Core acceptance assertion: citations are non-empty.
      expect((finding?.citations ?? []).length).toBeGreaterThan(0);
      for (const citation of finding?.citations ?? []) {
        expect(citation.source.length).toBeGreaterThan(0);
        expect(citation.snippet.length).toBeGreaterThan(0);
        expect(citation.agent).toBe("recovery");
      }
    },
  );
});
