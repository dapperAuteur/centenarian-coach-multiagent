// tests/coach.wiring.test.ts
// Key-free wiring test: the LLM and retrieval are mocked, so this runs in CI
// with no API keys. It verifies graph topology and state-passing: supervisor
// routing, the fan-out conditional edge, the synthesizer fan-in, and the
// SpecialistFinding / FinalAnswer shapes. Live behaviour is covered by
// coach.day1 / coach.workout / coach.recovery tests.

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mutable controller so tests can steer the mocked supervisor's routing.
const ctl = vi.hoisted(() => ({
  routeTo: ["nutrition"] as Array<"nutrition" | "workout" | "recovery">,
}));

vi.mock("@/lib/llm", () => ({
  buildChatModel: () => ({
    withStructuredOutput: (_schema: unknown, opts?: { name?: string }) => ({
      invoke: async (): Promise<unknown> => {
        switch (opts?.name) {
          case "route_to_specialists":
            return {
              agents: ctl.routeTo,
              primaryAgent: ctl.routeTo[0],
              subQuestions: ctl.routeTo.map((agent) => ({
                agent,
                question: `mock sub-question for ${agent}`,
              })),
              rationale: "mock routing decision",
            };
          case "assess_tools":
            return { needsCalorieTool: false, calorieArgs: null };
          case "assess_workout_tools":
            return { progressionArgs: null, mobilityArgs: null };
          case "assess_recovery_tools":
            return { sleepArgs: null, hrvArgs: null };
          case "compose_finding":
            return { text: "Mock specialist finding.\n\nSecond paragraph." };
          case "synthesize_answer":
            return { text: "Mock synthesized answer.\n\nSecond paragraph." };
          default:
            throw new Error(`unexpected structured-output name: ${String(opts?.name)}`);
        }
      },
    }),
  }),
}));

vi.mock("@/agents/nutrition/retrieval", () => ({
  retrieveNutritionKb: async () => [
    { source: "Mock Nutrition Source A", snippet: "Mock nutrition snippet A.", agent: "nutrition" },
    { source: "Mock Nutrition Source B", snippet: "Mock nutrition snippet B.", agent: "nutrition" },
  ],
}));

vi.mock("@/agents/workout/retrieval", () => ({
  retrieveWorkoutKb: async () => [
    { source: "Mock Workout Source A", snippet: "Mock workout snippet A.", agent: "workout" },
    { source: "Mock Workout Source B", snippet: "Mock workout snippet B.", agent: "workout" },
  ],
}));

vi.mock("@/agents/recovery/retrieval", () => ({
  retrieveRecoveryKb: async () => [
    { source: "Mock Recovery Source A", snippet: "Mock recovery snippet A.", agent: "recovery" },
    { source: "Mock Recovery Source B", snippet: "Mock recovery snippet B.", agent: "recovery" },
  ],
}));

const { coachGraph } = await import("@/graph");

describe("coach graph wiring (mocked — no API keys)", () => {
  beforeEach(() => {
    ctl.routeTo = ["nutrition"];
  });

  it("routes a nutrition-only question and synthesizes an answer", async () => {
    const result = await coachGraph.invoke({
      sessionId: "wiring-session",
      userQuery: "How much protein should an older adult eat?",
    });

    expect(result.routing?.agents).toEqual(["nutrition"]);
    expect(result.findings.nutrition?.agent).toBe("nutrition");
    expect(result.findings.nutrition?.citations).toHaveLength(2);
    expect(result.findings.workout).toBeUndefined();
    expect(result.findings.recovery).toBeUndefined();

    expect(result.finalAnswer?.text.length ?? 0).toBeGreaterThan(0);
    expect(result.finalAnswer?.consultedAgents).toEqual(["nutrition"]);
    expect(result.finalAnswer?.citations).toHaveLength(2);
  });

  it("routes a recovery-only question and synthesizes an answer", async () => {
    ctl.routeTo = ["recovery"];
    const result = await coachGraph.invoke({
      sessionId: "wiring-session",
      userQuery: "How much sleep do I need to recover?",
    });

    expect(result.routing?.agents).toEqual(["recovery"]);
    expect(result.findings.recovery?.agent).toBe("recovery");
    expect(result.findings.recovery?.citations).toHaveLength(2);
    expect(result.findings.nutrition).toBeUndefined();
    expect(result.findings.workout).toBeUndefined();

    expect(result.finalAnswer?.consultedAgents).toEqual(["recovery"]);
    expect(result.finalAnswer?.citations).toHaveLength(2);
  });

  it("fans out to all three specialists, then fans in to the synthesizer", async () => {
    ctl.routeTo = ["nutrition", "workout", "recovery"];
    const result = await coachGraph.invoke({
      sessionId: "wiring-session",
      userQuery:
        "I slept 5 hours, want to build muscle, and have legs planned today. What should I do?",
    });

    expect(result.routing?.agents).toEqual(["nutrition", "workout", "recovery"]);
    // All three specialists ran in parallel and the findings merged.
    expect(result.findings.nutrition?.agent).toBe("nutrition");
    expect(result.findings.workout?.agent).toBe("workout");
    expect(result.findings.recovery?.agent).toBe("recovery");

    // The synthesizer fanned in over all three findings.
    expect(result.finalAnswer?.text.length ?? 0).toBeGreaterThan(0);
    expect(result.finalAnswer?.consultedAgents).toEqual([
      "nutrition",
      "workout",
      "recovery",
    ]);
    expect(result.finalAnswer?.citations).toHaveLength(6);
  });
});
