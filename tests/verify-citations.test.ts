// tests/verify-citations.test.ts
// Key-free unit tests for the citation-coverage verify gate
// (src/agents/verify-citations.ts). The LLM boundary is mocked at
// @/lib/llm.buildChatModel, the same seam coach.wiring.test.ts uses, so
// these run in CI with no API keys.

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import type { Citation, ToolCallRecord } from "@/state";

// Mutable controller: tests steer what each structured-output call returns
// (or whether it throws), and the mock records invocations.
const ctl = vi.hoisted(() => ({
  // Value the verify_citations call resolves with; a function to allow throws.
  verifyImpl: (): unknown => ({ unsupportedClaims: [] }),
  // Value the compose_finding (revision) call resolves with.
  reviseImpl: (): unknown => ({ text: "Revised finding." }),
  verifyCalls: [] as unknown[][],
  reviseCalls: [] as unknown[][],
}));

// Mock chat model. withRoleFallback() composes structured output first, so
// the structured runnable (not the model) needs withFallbacks; it returns
// self so tests pass whether or not COACH_FALLBACK_PROVIDERS is set in
// .env.local (which vitest loads).
function makeMockModel() {
  return {
    withStructuredOutput: (_schema: unknown, opts?: { name?: string }) => {
      const structured = {
        invoke: async (messages: unknown[]): Promise<unknown> => {
          switch (opts?.name) {
            case "verify_citations":
              ctl.verifyCalls.push(messages);
              return ctl.verifyImpl();
            case "compose_finding":
              ctl.reviseCalls.push(messages);
              return ctl.reviseImpl();
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

vi.mock("@/lib/llm", () => ({
  buildChatModel: () => makeMockModel(),
}));

const { verifyCitationCoverage, makeVerifyReviseNode, VERIFY_CITATIONS_SYSTEM } =
  await import("@/agents/verify-citations");
const { CITE_OR_DROP_RULE } = await import("@/agents/shared-rules");

const citations: Citation[] = [
  { source: "Mock Source A", snippet: "Mock snippet A.", agent: "nutrition" },
];
const toolCalls: ToolCallRecord[] = [
  { name: "calorie_calculator", input: { weightKg: 70 }, output: { tdee: 2200 } },
];

beforeEach(() => {
  ctl.verifyImpl = () => ({ unsupportedClaims: [] });
  ctl.reviseImpl = () => ({ text: "Revised finding." });
  ctl.verifyCalls = [];
  ctl.reviseCalls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verify prompt reuses the shared cite-or-drop rule", () => {
  it("embeds CITE_OR_DROP_RULE verbatim (single source of truth)", () => {
    expect(VERIFY_CITATIONS_SYSTEM).toContain(CITE_OR_DROP_RULE);
  });
});

describe("verifyCitationCoverage", () => {
  it("passes when the verifier finds no unsupported claims", async () => {
    const result = await verifyCitationCoverage({
      draftText: "A fully grounded draft.",
      citations,
      toolCalls,
    });
    expect(result).toEqual({ pass: true, unsupportedClaims: [] });
    expect(result.verifierError).toBeUndefined();
    expect(ctl.verifyCalls).toHaveLength(1);
  });

  it("fails and returns the claims when the verifier lists them", async () => {
    ctl.verifyImpl = () => ({
      unsupportedClaims: ["Also consider taking magnesium."],
    });
    const result = await verifyCitationCoverage({
      draftText: "Draft with an uncited add-on.",
      citations,
      toolCalls,
    });
    expect(result.pass).toBe(false);
    expect(result.unsupportedClaims).toEqual([
      "Also consider taking magnesium.",
    ]);
    expect(result.verifierError).toBeUndefined();
  });

  it("surfaces verifierError on malformed verifier output — never a silent pass", async () => {
    ctl.verifyImpl = () => ({ somethingElse: true });
    const result = await verifyCitationCoverage({
      draftText: "Draft.",
      citations,
      toolCalls,
    });
    expect(result).toEqual({
      pass: true,
      unsupportedClaims: [],
      verifierError: true,
    });
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("surfaces verifierError when the verifier call throws", async () => {
    ctl.verifyImpl = () => {
      throw new Error("provider 500");
    };
    const result = await verifyCitationCoverage({
      draftText: "Draft.",
      citations,
      toolCalls,
    });
    expect(result).toEqual({
      pass: true,
      unsupportedClaims: [],
      verifierError: true,
    });
    expect(console.error).toHaveBeenCalledOnce();
  });
});

describe("makeVerifyReviseNode", () => {
  const state = {
    subQuestion: "How much protein?",
    citations,
    toolCalls,
    draftText: "Original draft.",
  };

  it("records a clean check and keeps the draft when verification passes", async () => {
    const node = makeVerifyReviseNode({
      composeSystem: "COMPOSE SYSTEM",
      includeToolBlock: true,
    });
    const update = await node(state);
    expect(update).toEqual({
      citationCheck: { unsupportedCount: 0, revised: false },
    });
    expect(ctl.reviseCalls).toHaveLength(0);
  });

  it("revises exactly once when claims are unsupported, listing them in the instruction", async () => {
    ctl.verifyImpl = () => ({
      unsupportedClaims: ["Claim one.", "Claim two."],
    });
    const node = makeVerifyReviseNode({
      composeSystem: "COMPOSE SYSTEM",
      includeToolBlock: true,
    });
    const update = await node(state);

    expect(update.draftText).toBe("Revised finding.");
    expect(update.citationCheck).toEqual({ unsupportedCount: 2, revised: true });

    // One revision call, no second verification loop.
    expect(ctl.verifyCalls).toHaveLength(1);
    expect(ctl.reviseCalls).toHaveLength(1);

    // The revision re-sends the original compose messages plus the
    // unsupported-claims instruction.
    const messages = ctl.reviseCalls[0] as Array<{
      role: string;
      content: string;
    }>;
    expect(messages[0]).toEqual({ role: "system", content: "COMPOSE SYSTEM" });
    expect(messages[1].content).toContain("Question: How much protein?");
    expect(messages[1].content).toContain("Tool results:");
    expect(messages[2]).toEqual({
      role: "assistant",
      content: "Original draft.",
    });
    expect(messages[3].content).toContain("- Claim one.");
    expect(messages[3].content).toContain("- Claim two.");
    expect(messages[3].content).toContain(
      "either ground it in the provided sources/tool results or cut it entirely",
    );
  });

  it("omits the tool block from the revision message when includeToolBlock is false", async () => {
    ctl.verifyImpl = () => ({ unsupportedClaims: ["Claim."] });
    const node = makeVerifyReviseNode({
      composeSystem: "CORRECTIVE SYSTEM",
      includeToolBlock: false,
    });
    await node({ ...state, toolCalls: [] });
    const messages = ctl.reviseCalls[0] as Array<{ content: string }>;
    expect(messages[1].content).not.toContain("Tool results:");
  });

  it("keeps the original draft and flags verifierError when the revision call fails", async () => {
    ctl.verifyImpl = () => ({ unsupportedClaims: ["Claim."] });
    ctl.reviseImpl = () => {
      throw new Error("provider 500 during revision");
    };
    const node = makeVerifyReviseNode({
      composeSystem: "COMPOSE SYSTEM",
      includeToolBlock: true,
    });
    const update = await node(state);
    expect(update.draftText).toBeUndefined();
    expect(update.citationCheck).toEqual({
      unsupportedCount: 1,
      revised: false,
      verifierError: true,
    });
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("passes the draft through with verifierError when the verifier itself fails", async () => {
    ctl.verifyImpl = () => {
      throw new Error("provider down");
    };
    const node = makeVerifyReviseNode({
      composeSystem: "COMPOSE SYSTEM",
      includeToolBlock: true,
    });
    const update = await node(state);
    expect(update.draftText).toBeUndefined();
    expect(update.citationCheck).toEqual({
      unsupportedCount: 0,
      revised: false,
      verifierError: true,
    });
    expect(ctl.reviseCalls).toHaveLength(0);
  });
});
