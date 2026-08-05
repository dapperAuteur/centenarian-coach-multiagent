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
const {
  extractMarkers,
  findOutOfRangeMarkers,
  offsetMarkers,
  remapFindingMarkers,
} = await import("@/lib/citation-markers");

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

  it("the shared rule carries the inline-marker requirement", () => {
    expect(CITE_OR_DROP_RULE).toContain("Inline citation markers");
    expect(CITE_OR_DROP_RULE).toContain("[1][3]");
  });
});

describe("citation-marker helpers (pure)", () => {
  it("extractMarkers returns marker numbers in order, keeping duplicates", () => {
    expect(
      extractMarkers("Protein matters [2]. Sleep too [1][3], really [2]."),
    ).toEqual([2, 1, 3, 2]);
  });

  it("extractMarkers ignores non-numeric brackets and finds nothing in plain prose", () => {
    expect(extractMarkers("No markers here, [not one], [1.5], [a]. ")).toEqual(
      [],
    );
    expect(extractMarkers("")).toEqual([]);
  });

  it("findOutOfRangeMarkers flags distinct markers outside 1..count, sorted", () => {
    expect(
      findOutOfRangeMarkers("Claims [0] and [4], again [4], fine [2].", 3),
    ).toEqual([0, 4]);
    expect(findOutOfRangeMarkers("All good [1][2][3].", 3)).toEqual([]);
    expect(findOutOfRangeMarkers("Any marker [1] is out.", 0)).toEqual([1]);
  });

  it("offsetMarkers shifts every marker by the offset", () => {
    expect(offsetMarkers("A [1] and B [2][3].", 5)).toBe("A [6] and B [7][8].");
  });

  it("offsetMarkers with offset 0 returns the text unchanged", () => {
    const text = "A [1] and B [2].";
    expect(offsetMarkers(text, 0)).toBe(text);
  });

  it("remapFindingMarkers shifts each finding by the prior findings' citation counts", () => {
    const findings = [
      { text: "Nutrition claim [1], another [2].", citations: [{}, {}] },
      { text: "Workout claim [1][3].", citations: [{}, {}, {}] },
      { text: "Recovery claim [2].", citations: [{}, {}] },
    ];
    expect(remapFindingMarkers(findings)).toEqual([
      "Nutrition claim [1], another [2].",
      "Workout claim [3][5].",
      "Recovery claim [7].",
    ]);
  });

  it("remapFindingMarkers handles findings with empty citations (offset unchanged)", () => {
    const findings = [
      { text: "Tool-grounded only, no markers.", citations: [] },
      { text: "Second finding [1].", citations: [{}] },
      { text: "Third finding [1].", citations: [{}] },
    ];
    expect(remapFindingMarkers(findings)).toEqual([
      "Tool-grounded only, no markers.",
      "Second finding [1].",
      "Third finding [2].",
    ]);
  });

  it("remapFindingMarkers leaves marker-free prose alone and handles no findings", () => {
    expect(
      remapFindingMarkers([
        { text: "No markers at all.", citations: [{}, {}] },
        { text: "Still none.", citations: [{}] },
      ]),
    ).toEqual(["No markers at all.", "Still none."]);
    expect(remapFindingMarkers([])).toEqual([]);
  });
});

describe("verifyCitationCoverage", () => {
  it("passes when the verifier finds no unsupported claims", async () => {
    const result = await verifyCitationCoverage({
      draftText: "A fully grounded draft.",
      citations,
      toolCalls,
    });
    expect(result).toEqual({
      pass: true,
      unsupportedClaims: [],
      outOfRangeMarkers: [],
    });
    expect(result.verifierError).toBeUndefined();
    expect(ctl.verifyCalls).toHaveLength(1);
  });

  it("fails deterministically on out-of-range markers even when the LLM check passes", async () => {
    const result = await verifyCitationCoverage({
      draftText: "Grounded claim [1]. Phantom claim [3].",
      citations, // only one citation -> [3] is out of range
      toolCalls,
    });
    expect(result.pass).toBe(false);
    expect(result.outOfRangeMarkers).toEqual([3]);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("still fails on out-of-range markers when the verifier call throws (deterministic layer needs no model)", async () => {
    ctl.verifyImpl = () => {
      throw new Error("provider 500");
    };
    const result = await verifyCitationCoverage({
      draftText: "Phantom claim [9].",
      citations,
      toolCalls,
    });
    expect(result).toEqual({
      pass: false,
      unsupportedClaims: [],
      outOfRangeMarkers: [9],
      verifierError: true,
    });
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
      outOfRangeMarkers: [],
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
      outOfRangeMarkers: [],
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
      "either ground the claim in the provided sources/tool results with the correct inline [n] marker(s), or cut it entirely",
    );
  });

  it("revises on out-of-range markers alone, naming them in the instruction and in telemetry", async () => {
    // LLM check passes; the deterministic layer alone forces the revision.
    const node = makeVerifyReviseNode({
      composeSystem: "COMPOSE SYSTEM",
      includeToolBlock: true,
    });
    const update = await node({
      ...state,
      draftText: "Grounded [1]. Phantom [4], phantom again [7].",
    });
    expect(update.draftText).toBe("Revised finding.");
    expect(update.citationCheck).toEqual({
      unsupportedCount: 0,
      revised: true,
      markersOutOfRange: 2,
    });
    const messages = ctl.reviseCalls[0] as Array<{ content: string }>;
    expect(messages[3].content).toContain("marker [4]");
    expect(messages[3].content).toContain("marker [7]");
  });

  it("attempts the revision for out-of-range markers even when the LLM verifier throws", async () => {
    ctl.verifyImpl = () => {
      throw new Error("provider down");
    };
    const node = makeVerifyReviseNode({
      composeSystem: "COMPOSE SYSTEM",
      includeToolBlock: true,
    });
    const update = await node({ ...state, draftText: "Phantom [9]." });
    expect(update.draftText).toBe("Revised finding.");
    expect(update.citationCheck).toEqual({
      unsupportedCount: 0,
      revised: true,
      markersOutOfRange: 1,
      verifierError: true,
    });
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
