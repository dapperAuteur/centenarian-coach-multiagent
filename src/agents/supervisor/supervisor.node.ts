// src/agents/supervisor/supervisor.node.ts
// The supervisor classifies the user's question and returns a structured
// routing decision. It runs before any specialist (enforced by graph
// topology) and never reads specialist findings.

import { buildChatModel } from "@/lib/llm";
import type { CoachState, CoachUpdate, RoutingDecision } from "@/state";
import { RoutingSchema } from "./routing.schema";

const SUPERVISOR_SYSTEM = `You are the routing supervisor for the Centenarian Coach, a longevity-focused health assistant. There are three specialist agents:
- nutrition: diet, macros, calories, protein, recipes, supplements, eating patterns, fasting.
- workout: strength training, cardio, mobility, exercise programming, progression.
- recovery: sleep, HRV, rest days, stress, readiness.

Decide which specialist(s) should answer the user's question. Most questions need exactly one specialist. A genuinely cross-domain question may need two or all three — but do not route to a specialist whose domain the question does not touch.

For every specialist you select, write a focused sub-question that rewrites the user's question into that specialist's domain. \`primaryAgent\` must be one of the agents you selected. Keep \`rationale\` to one sentence.`;

export async function supervisorNode(state: CoachState): Promise<CoachUpdate> {
  const router = (
    await buildChatModel({
      role: "supervisor",
      temperature: 0,
    })
  ).withStructuredOutput(RoutingSchema, { name: "route_to_specialists" });

  const decision = await router.invoke([
    { role: "system", content: SUPERVISOR_SYSTEM },
    { role: "user", content: state.userQuery },
  ]);

  const subQuestions: RoutingDecision["subQuestions"] = {};
  for (const entry of decision.subQuestions) {
    subQuestions[entry.agent] = entry.question;
  }

  // Normalize: dedupe `agents` and guarantee `primaryAgent` is a member
  // (the Zod schema cannot enforce that cross-field invariant).
  const agents: RoutingDecision["agents"] = [...new Set(decision.agents)];
  const primaryAgent = agents.includes(decision.primaryAgent)
    ? decision.primaryAgent
    : agents[0];

  const routing: RoutingDecision = {
    agents,
    primaryAgent,
    subQuestions,
    rationale: decision.rationale,
  };

  return { routing };
}
