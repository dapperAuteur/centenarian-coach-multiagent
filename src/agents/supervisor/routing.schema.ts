// src/agents/supervisor/routing.schema.ts
// Zod schema for the supervisor's structured routing decision. The supervisor
// MUST return this before any specialist runs.

import { z } from "zod";

export const AgentEnum = z.enum(["nutrition", "workout", "recovery"]);

export const RoutingSchema = z.object({
  agents: z
    .array(AgentEnum)
    .min(1)
    .describe("Specialist(s) that should answer this question."),
  primaryAgent: AgentEnum.describe(
    "The single most relevant specialist. Must be one of `agents`.",
  ),
  subQuestions: z
    .array(
      z.object({
        agent: AgentEnum,
        question: z
          .string()
          .min(1)
          .describe("The user's question rewritten for this specialist."),
      }),
    )
    .describe("One entry per selected agent."),
  rationale: z
    .string()
    .min(1)
    .max(500)
    .describe("One-sentence justification for the routing choice."),
});

export type RoutingSchemaOutput = z.infer<typeof RoutingSchema>;
