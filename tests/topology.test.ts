// tests/topology.test.ts
// The topology-enforces-ordering test (Module 1). The supervisor ALWAYS runs
// before any specialist, and the synthesizer ALWAYS runs last — and that order
// is a guarantee of the graph's STRUCTURE (its edges), not of prompt discipline
// or luck. We prove it by streaming node-completion order for both a single
// route and a full fan-out: in every case supervisor is first, synthesize is
// last, and every specialist that ran falls strictly between them.
//
// LLM + retrieval are mocked (same pattern as coach.wiring.test.ts), so this
// runs in CI with no API keys.

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mutable controller so a test can steer the mocked supervisor's routing.
const ctl = vi.hoisted(() => ({
  routeTo: ["nutrition"] as Array<"nutrition" | "workout" | "recovery">,
}));

function makeMockModel() {
  return {
    withStructuredOutput: (_schema: unknown, opts?: { name?: string }) => {
      const structured = {
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
              throw new Error(
                `unexpected structured-output name: ${String(opts?.name)}`,
              );
          }
        },
        withFallbacks: (_fallbacks: unknown[]) => structured,
      };
      return structured;
    },
  };
}

vi.mock("@/lib/llm", () => ({ buildChatModel: () => makeMockModel() }));

vi.mock("@/agents/nutrition/retrieval", () => ({
  retrieveNutritionKb: async () => [
    { source: "Mock Nutrition Source", snippet: "Mock nutrition snippet.", agent: "nutrition" },
  ],
}));
vi.mock("@/agents/workout/retrieval", () => ({
  retrieveWorkoutKb: async () => [
    { source: "Mock Workout Source", snippet: "Mock workout snippet.", agent: "workout" },
  ],
}));
vi.mock("@/agents/recovery/retrieval", () => ({
  retrieveRecoveryKb: async () => [
    { source: "Mock Recovery Source", snippet: "Mock recovery snippet.", agent: "recovery" },
  ],
}));

const { coachGraph } = await import("@/graph");

const SPECIALISTS = ["nutrition", "workout", "recovery", "corrective"] as const;

/** Stream the graph and collect node-completion order from "updates" chunks. */
async function nodeOrder(userQuery: string): Promise<string[]> {
  const order: string[] = [];
  const stream = await coachGraph.stream(
    { sessionId: "topology", userQuery },
    { streamMode: "updates" },
  );
  for await (const chunk of stream) {
    for (const node of Object.keys(chunk as Record<string, unknown>)) {
      order.push(node);
    }
  }
  return order;
}

/** supervisor first, synthesize last, every specialist that ran in between. */
function assertOrdering(order: string[]): void {
  expect(order[0]).toBe("supervisor");
  expect(order[order.length - 1]).toBe("synthesize");

  const supervisorIndex = order.indexOf("supervisor");
  const synthesizeIndex = order.lastIndexOf("synthesize");
  for (const specialist of SPECIALISTS) {
    const at = order.indexOf(specialist);
    if (at === -1) continue; // not routed this time
    expect(at).toBeGreaterThan(supervisorIndex);
    expect(at).toBeLessThan(synthesizeIndex);
  }
}

describe("topology enforces ordering (mocked — no API keys)", () => {
  beforeEach(() => {
    ctl.routeTo = ["nutrition"];
  });

  it("runs supervisor first and synthesize last for a single-specialist route", async () => {
    ctl.routeTo = ["nutrition"];
    const order = await nodeOrder("How much protein should an older adult eat?");
    expect(order).toContain("supervisor");
    expect(order).toContain("nutrition");
    assertOrdering(order);
  });

  it("keeps the ordering across a full fan-out, regardless of fan-out width", async () => {
    ctl.routeTo = ["nutrition", "workout", "recovery"];
    const order = await nodeOrder(
      "I slept five hours, want to build muscle, and have legs today. What should I do?",
    );
    for (const specialist of ["nutrition", "workout", "recovery"]) {
      expect(order).toContain(specialist);
    }
    assertOrdering(order);
  });
});
