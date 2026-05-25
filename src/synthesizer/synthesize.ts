// src/synthesizer/synthesize.ts
// The synthesizer node. It runs after the specialists and weaves their
// findings into one cohesive answer. It is the ONLY node that reads multiple
// specialists' findings — the specialists never read each other's.

import { z } from "zod";
import { buildChatModelWithFallback } from "@/lib/with-fallback";
import type {
  Agent,
  Citation,
  CoachState,
  CoachUpdate,
  SpecialistFinding,
} from "@/state";

const SYNTHESIZE_SYSTEM = `You are the coordinator of the Centenarian Coach, a longevity-focused health assistant. You receive findings from one or more specialist agents (nutrition, workout, recovery, corrective).

Weave the findings into ONE cohesive answer addressed to the user, in 2-4 short paragraphs. Every claim must be supported by the specialists' findings; do not introduce facts they did not provide. When the question is cross-domain, connect the specialists' advice rather than listing it separately. Be practical and specific. Write in plain prose. Do not use em-dashes; use commas, parentheses, or separate sentences instead.

Do not write your own citations list; the system attaches citations separately.`;

const SynthesizeSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe("The synthesized 2-4 paragraph answer for the user."),
});

export async function synthesizeNode(state: CoachState): Promise<CoachUpdate> {
  const findings: SpecialistFinding[] = [];
  for (const agent of [
    "nutrition",
    "workout",
    "recovery",
    "corrective",
  ] as const) {
    const finding = state.findings[agent];
    if (finding) findings.push(finding);
  }

  const consultedAgents: Agent[] = findings.map((f) => f.agent);
  const citations: Citation[] = findings.flatMap((f) => f.citations);

  if (findings.length === 0) {
    return {
      finalAnswer: {
        text: "No specialist was available to answer this question.",
        citations: [],
        consultedAgents: [],
      },
    };
  }

  const findingsBlock = findings
    .map((f) => `### ${f.agent} specialist\n${f.text}`)
    .join("\n\n");

  const model = (
    await buildChatModelWithFallback({
      role: "synthesizer",
      temperature: 0.3,
      maxTokens: 2048,
    })
  ).withStructuredOutput(SynthesizeSchema, { name: "synthesize_answer" });

  const result = await model.invoke([
    { role: "system", content: SYNTHESIZE_SYSTEM },
    {
      role: "user",
      content: `User question: ${state.userQuery}\n\nSpecialist findings:\n${findingsBlock}`,
    },
  ]);

  return {
    finalAnswer: { text: result.text, citations, consultedAgents },
  };
}
