// tests/safety-classifier.test.ts
// Key-free unit tests for the post-response safety classifier: the LLM and
// the DB are mocked (same pattern as coach.wiring.test.ts), so this runs in
// CI with no API keys and no database. Verifies the prompt wiring (role +
// structured-output name), the no-trigger fast path (no row written), and
// the never-throw contract on model/DB errors.

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mutable controller so tests steer the mocked classifier's output.
const ctl = vi.hoisted(() => ({
  classification: {
    triggers: ["pain"] as string[],
    referralIncluded: true,
    summary: "User reported knee pain during squats.",
  },
  modelError: null as Error | null,
  dbError: null as Error | null,
  inserted: [] as Record<string, unknown>[],
  invocations: [] as { name?: string; messages: unknown }[],
  buildOptions: [] as unknown[],
}));

// Mock chat model, mirroring coach.wiring.test.ts: withRoleFallback() calls
// model.withStructuredOutput(...) and may compose withFallbacks on the
// structured runnable, which returns self.
vi.mock("@/lib/llm", () => ({
  buildChatModel: (options: unknown) => {
    ctl.buildOptions.push(options);
    return {
      withStructuredOutput: (_schema: unknown, opts?: { name?: string }) => {
        const structured = {
          invoke: async (messages: unknown): Promise<unknown> => {
            ctl.invocations.push({ name: opts?.name, messages });
            if (ctl.modelError) throw ctl.modelError;
            if (opts?.name !== "classify_safety") {
              throw new Error(
                `unexpected structured-output name: ${String(opts?.name)}`,
              );
            }
            return ctl.classification;
          },
          withFallbacks: (_fallbacks: unknown[]) => structured,
        };
        return structured;
      },
    };
  },
}));

// Mock the DB layer: capture insert values instead of talking to Neon.
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    insert: (_table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        if (ctl.dbError) throw ctl.dbError;
        ctl.inserted.push(values);
      },
    }),
  }),
}));

const { classifySafety, recordSafetyEvent, SAFETY_TRIGGERS } = await import(
  "@/lib/safety-classifier"
);

describe("safety classifier (mocked — no API keys, no DB)", () => {
  beforeEach(() => {
    ctl.classification = {
      triggers: ["pain"],
      referralIncluded: true,
      summary: "User reported knee pain during squats.",
    };
    ctl.modelError = null;
    ctl.dbError = null;
    ctl.inserted = [];
    ctl.invocations = [];
    ctl.buildOptions = [];
  });

  it("names the five BAM-approved triggers", () => {
    expect(SAFETY_TRIGGERS).toEqual([
      "pain",
      "chronic_fatigue_overtraining",
      "restrictive_eating_intense_training",
      "aggressive_cutting_crash_diet",
      "severe_sleep_deprivation_high_load",
    ]);
  });

  it("calls the composer role at temperature 0 with the classify_safety tool name", async () => {
    const result = await classifySafety({
      userQuery: "My knee hurts when I squat.",
      finalAnswerText: "Please see a physical therapist.",
    });

    expect(result.triggers).toEqual(["pain"]);
    expect(result.referralIncluded).toBe(true);
    expect(ctl.buildOptions[0]).toMatchObject({
      role: "composer",
      temperature: 0,
    });
    expect(ctl.invocations).toHaveLength(1);
    expect(ctl.invocations[0]?.name).toBe("classify_safety");
    // Both sides of the exchange reach the model.
    const messages = ctl.invocations[0]?.messages as {
      role: string;
      content: string;
    }[];
    expect(messages[1]?.content).toContain("My knee hurts when I squat.");
    expect(messages[1]?.content).toContain("see a physical therapist");
  });

  it("dedupes repeated trigger ids from the model", async () => {
    ctl.classification = {
      triggers: ["pain", "pain"],
      referralIncluded: false,
      summary: "Pain mentioned twice.",
    };
    const result = await classifySafety({
      userQuery: "q",
      finalAnswerText: "a",
    });
    expect(result.triggers).toEqual(["pain"]);
  });

  it("writes a safety_events row when a trigger fired", async () => {
    const longQuery = `My knee hurts. ${"x".repeat(300)}`;
    await recordSafetyEvent({
      sessionId: "11111111-2222-3333-4444-555555555555",
      userQuery: longQuery,
      finalAnswerText: "See a physical therapist.",
    });

    expect(ctl.inserted).toHaveLength(1);
    expect(ctl.inserted[0]).toMatchObject({
      sessionId: "11111111-2222-3333-4444-555555555555",
      triggers: ["pain"],
      referralIncluded: true,
      summary: "User reported knee pain during squats.",
    });
    // Excerpt is capped at ~200 chars.
    expect(ctl.inserted[0]?.userQueryExcerpt).toBe(longQuery.slice(0, 200));
  });

  it("writes no row when no trigger fired", async () => {
    ctl.classification = {
      triggers: [],
      referralIncluded: false,
      summary: "No safety concern.",
    };
    await recordSafetyEvent({
      sessionId: "11111111-2222-3333-4444-555555555555",
      userQuery: "How much protein should I eat?",
      finalAnswerText: "About 1.2 g/kg.",
    });
    expect(ctl.inserted).toHaveLength(0);
  });

  it("never throws into the request path when the model errors", async () => {
    ctl.modelError = new Error("provider is down");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        recordSafetyEvent({
          sessionId: "11111111-2222-3333-4444-555555555555",
          userQuery: "My knee hurts.",
          finalAnswerText: "answer",
        }),
      ).resolves.toBeUndefined();
      expect(ctl.inserted).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("never throws into the request path when the DB insert errors", async () => {
    ctl.dbError = new Error("db unreachable");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        recordSafetyEvent({
          sessionId: "11111111-2222-3333-4444-555555555555",
          userQuery: "My knee hurts.",
          finalAnswerText: "answer",
        }),
      ).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
