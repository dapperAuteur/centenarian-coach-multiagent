// tests/coach.wiring.test.ts
// Key-free wiring test: the LLM and retrieval are mocked, so this runs in CI
// with no API keys. It verifies graph topology and state-passing — supervisor
// routing, the conditional edge into/around the Nutrition node, and the
// SpecialistFinding shape. Live behaviour is covered by coach.day1.test.ts.

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mutable controller so tests can steer the mocked supervisor's routing.
const ctl = vi.hoisted(() => ({
  routeTo: ["nutrition"] as Array<"nutrition" | "workout" | "recovery">,
}));

vi.mock("@/lib/llm", () => ({
  SUPERVISOR_MODEL: "mock-supervisor",
  COMPOSER_MODEL: "mock-composer",
  buildChatAnthropic: () => ({
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
          case "compose_finding":
            return {
              text: "Mock nutrition finding paragraph one.\n\nParagraph two.",
            };
          default:
            throw new Error(`unexpected structured-output name: ${String(opts?.name)}`);
        }
      },
    }),
  }),
}));

vi.mock("@/agents/nutrition/retrieval", () => ({
  retrieveNutritionKb: async () => [
    { source: "Mock Nutrition Source A", snippet: "Mock snippet A.", agent: "nutrition" },
    { source: "Mock Nutrition Source B", snippet: "Mock snippet B.", agent: "nutrition" },
  ],
}));

const { coachGraph } = await import("@/graph");

describe("coach graph wiring (mocked — no API keys)", () => {
  beforeEach(() => {
    ctl.routeTo = ["nutrition"];
  });

  it("routes a nutrition question through the Nutrition specialist with citations", async () => {
    const result = await coachGraph.invoke({
      sessionId: "wiring-session",
      userQuery: "How much protein should an older adult eat?",
    });

    expect(result.routing?.agents).toEqual(["nutrition"]);
    expect(result.routing?.primaryAgent).toBe("nutrition");
    expect(result.routing?.subQuestions.nutrition).toBeTruthy();

    const finding = result.findings.nutrition;
    expect(finding).toBeDefined();
    expect(finding?.agent).toBe("nutrition");
    expect((finding?.text ?? "").length).toBeGreaterThan(0);
    expect(finding?.citations).toHaveLength(2);
    expect((finding?.citations ?? []).every((c) => c.agent === "nutrition")).toBe(true);
    expect(finding?.toolCalls).toEqual([]);
    expect(typeof finding?.durationMs).toBe("number");
  });

  it("skips the Nutrition node when routing excludes nutrition", async () => {
    ctl.routeTo = ["workout"];
    const result = await coachGraph.invoke({
      sessionId: "wiring-session",
      userQuery: "How do I progress my squat?",
    });

    expect(result.routing?.agents).toEqual(["workout"]);
    expect(result.findings.nutrition).toBeUndefined();
  });
});
