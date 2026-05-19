// tests/coach.wiring.test.ts
// Key-free wiring test: the LLM and retrieval are mocked, so this runs in CI
// with no API keys. It verifies graph topology and state-passing — supervisor
// routing, the fan-out conditional edge, and the SpecialistFinding shape.
// Live behaviour is covered by coach.day1.test.ts and coach.workout.test.ts.

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
          case "compose_finding":
            return { text: "Mock specialist finding.\n\nSecond paragraph." };
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

const { coachGraph } = await import("@/graph");

describe("coach graph wiring (mocked — no API keys)", () => {
  beforeEach(() => {
    ctl.routeTo = ["nutrition"];
  });

  it("routes a nutrition-only question through the Nutrition specialist", async () => {
    const result = await coachGraph.invoke({
      sessionId: "wiring-session",
      userQuery: "How much protein should an older adult eat?",
    });

    expect(result.routing?.agents).toEqual(["nutrition"]);
    const finding = result.findings.nutrition;
    expect(finding).toBeDefined();
    expect(finding?.agent).toBe("nutrition");
    expect(finding?.citations).toHaveLength(2);
    expect((finding?.citations ?? []).every((c) => c.agent === "nutrition")).toBe(true);
    expect(result.findings.workout).toBeUndefined();
  });

  it("routes a workout-only question through the Workout specialist", async () => {
    ctl.routeTo = ["workout"];
    const result = await coachGraph.invoke({
      sessionId: "wiring-session",
      userQuery: "How do I progress my squat?",
    });

    expect(result.routing?.agents).toEqual(["workout"]);
    const finding = result.findings.workout;
    expect(finding).toBeDefined();
    expect(finding?.agent).toBe("workout");
    expect(finding?.citations).toHaveLength(2);
    expect((finding?.citations ?? []).every((c) => c.agent === "workout")).toBe(true);
    expect(result.findings.nutrition).toBeUndefined();
  });

  it("fans out to both specialists on a cross-domain question", async () => {
    ctl.routeTo = ["nutrition", "workout"];
    const result = await coachGraph.invoke({
      sessionId: "wiring-session",
      userQuery: "Should I eat more and lift heavier to gain muscle?",
    });

    expect(result.routing?.agents).toEqual(["nutrition", "workout"]);
    // Both specialists ran in parallel and the findings merged.
    expect(result.findings.nutrition?.agent).toBe("nutrition");
    expect(result.findings.workout?.agent).toBe("workout");
    expect(result.findings.nutrition?.citations).toHaveLength(2);
    expect(result.findings.workout?.citations).toHaveLength(2);
  });
});
