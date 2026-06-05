// tests/evals.rubric.test.ts
// Pure unit tests for the eval rubric — no API, no network. These run as part
// of the default `pnpm test` (unlike the live eval runner, which is opt-in).

import { describe, it, expect } from "vitest";
import {
  routingScore,
  citationScore,
  emptyRetrievalScore,
  type EvalExample,
} from "../evals/rubric";
import type { Citation, CoachState } from "@/state";

const cite = (agent: Citation["agent"]): Citation => ({
  source: "Mock Source",
  snippet: "Mock snippet.",
  agent,
});

/** Build a synthetic CoachState for routing `agents`, with a cited finding
 * for each. */
function stateFor(agents: Array<"nutrition" | "workout" | "recovery">): CoachState {
  const findings: CoachState["findings"] = {};
  for (const agent of agents) {
    findings[agent] = {
      agent,
      text: "finding",
      citations: [cite(agent)],
      toolCalls: [],
      durationMs: 1,
    };
  }
  return {
    sessionId: "t",
    userQuery: "q",
    routing: {
      agents,
      primaryAgent: agents[0] ?? "nutrition",
      subQuestions: {},
      rationale: "r",
    },
    findings,
    finalAnswer: {
      text: "answer",
      citations: agents.map(cite),
      consultedAgents: agents,
    },
  };
}

describe("routingScore", () => {
  it("scores 1 on an exact set match (order-independent)", () => {
    const state = stateFor(["workout", "nutrition"]);
    const example: EvalExample = {
      id: "x",
      question: "q",
      expectedAgents: ["nutrition", "workout"],
    };
    expect(routingScore(state, example).score).toBe(1);
  });

  it("scores 0 when an agent is missing or extra", () => {
    const state = stateFor(["nutrition"]);
    const example: EvalExample = {
      id: "x",
      question: "q",
      expectedAgents: ["nutrition", "workout"],
    };
    const result = routingScore(state, example);
    expect(result.score).toBe(0);
    expect(result.comment).toContain("expected");
  });
});

describe("citationScore", () => {
  it("scores 1 when every finding and the answer are cited", () => {
    expect(citationScore(stateFor(["nutrition", "recovery"])).score).toBe(1);
  });

  it("scores 0 when a finding has no citation", () => {
    const state = stateFor(["nutrition"]);
    state.findings.nutrition!.citations = [];
    expect(citationScore(state).score).toBe(0);
  });

  it("scores 0 when the final answer has no citations", () => {
    const state = stateFor(["nutrition"]);
    state.finalAnswer!.citations = [];
    expect(citationScore(state).score).toBe(0);
  });
});

describe("emptyRetrievalScore", () => {
  it("scores 1 on a productive run (findings cited, no refusal)", () => {
    expect(emptyRetrievalScore(stateFor(["workout", "recovery"])).score).toBe(
      1,
    );
  });

  it("scores 0 when a specialist returned zero sources", () => {
    const state = stateFor(["workout"]);
    state.findings.workout!.citations = [];
    const result = emptyRetrievalScore(state);
    expect(result.score).toBe(0);
    expect(result.comment).toContain("zero sources");
  });

  it("scores 0 when the answer reads as a no-sources refusal", () => {
    const state = stateFor(["workout"]);
    state.finalAnswer!.text =
      "The sources provided do not contain information about fall prevention.";
    const result = emptyRetrievalScore(state);
    expect(result.score).toBe(0);
    expect(result.comment).toContain("refusal");
  });

  it("scores 0 when no findings were produced", () => {
    expect(emptyRetrievalScore(stateFor([])).score).toBe(0);
  });
});
