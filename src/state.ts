// src/state.ts
// Shared graph state for the Centenarian Coach (PRD-2 v2, Section 7).
// Demo mode is single-tenant: no userId.

import { Annotation } from "@langchain/langgraph";

export type Agent = "nutrition" | "workout" | "recovery";

export interface Citation {
  /** Doc title or source label. */
  source: string;
  /** 1-2 sentence excerpt. */
  snippet: string;
  agent: Agent;
}

export interface ToolCallRecord {
  name: string;
  input: unknown;
  output: unknown;
}

export interface SpecialistFinding {
  agent: Agent;
  text: string;
  citations: Citation[];
  toolCalls: ToolCallRecord[];
  durationMs: number;
}

export interface RoutingDecision {
  /** Specialists the supervisor chose to consult. */
  agents: Agent[];
  /** Single most relevant specialist; always a member of `agents`. */
  primaryAgent: Agent;
  /** Per-specialist rewritten sub-question; keyed only for chosen agents. */
  subQuestions: Partial<Record<Agent, string>>;
  rationale: string;
}

export interface FindingsMap {
  nutrition?: SpecialistFinding;
  workout?: SpecialistFinding;
  recovery?: SpecialistFinding;
}

export interface FinalAnswer {
  text: string;
  citations: Citation[];
  consultedAgents: Agent[];
}

/**
 * Top-level coach state.
 *
 * `findings` uses an object-merge reducer so that, once Workout/Recovery run as
 * parallel branches, two specialist nodes can each write
 * `{ findings: { <agent>: ... } }` in the same superstep without clobbering one
 * another. Every specialist writes ONLY its own slot.
 */
export const CoachAnnotation = Annotation.Root({
  sessionId: Annotation<string>(),
  userQuery: Annotation<string>(),
  routing: Annotation<RoutingDecision | undefined>(),
  findings: Annotation<FindingsMap>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  finalAnswer: Annotation<FinalAnswer | undefined>(),
});

export type CoachState = typeof CoachAnnotation.State;
export type CoachUpdate = typeof CoachAnnotation.Update;
