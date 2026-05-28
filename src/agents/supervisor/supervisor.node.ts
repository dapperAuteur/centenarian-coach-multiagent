// src/agents/supervisor/supervisor.node.ts
// The supervisor classifies the user's question and returns a structured
// routing decision. It runs before any specialist (enforced by graph
// topology) and never reads specialist findings.

import { withRoleFallback } from "@/lib/with-fallback";
import type { CoachState, CoachUpdate, RoutingDecision } from "@/state";
import { RoutingSchema } from "./routing.schema";

const SUPERVISOR_SYSTEM = `You are the routing supervisor for the Centenarian Coach, a longevity-focused health assistant. There are four specialist agents:
- nutrition: diet, macros, calories, protein, recipes, supplements, eating patterns, fasting.
- workout: strength training, cardio, exercise programming, progression, periodization.
- recovery: sleep, HRV, rest days, stress, readiness.
- corrective: movement assessment, postural imbalances, muscle inhibition/lengthening/activation/integration techniques (e.g. SMR/foam rolling, static or dynamic stretching), mobility, flexibility, and corrective exercise progressions for specific body regions (foot/ankle, knee, LPHC, thoracic spine, shoulder, wrist/elbow, cervical spine).

Decide which specialist(s) should answer the user's question. Most questions need exactly one specialist. A genuinely cross-domain question may need two or more, but do not route to a specialist whose domain the question does not touch.

For every specialist you select, write a focused sub-question that rewrites the user's question into that specialist's domain. \`primaryAgent\` must be one of the agents you selected. Keep \`rationale\` to one sentence.`;

export async function supervisorNode(state: CoachState): Promise<CoachUpdate> {
  const router = await withRoleFallback(
    { role: "supervisor", temperature: 0 },
    (m) =>
      m.withStructuredOutput(RoutingSchema, { name: "route_to_specialists" }),
  );

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
