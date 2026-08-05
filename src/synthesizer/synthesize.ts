// src/synthesizer/synthesize.ts
// The synthesizer node. It runs after the specialists and weaves their
// findings into one cohesive answer. It is the ONLY node that reads multiple
// specialists' findings — the specialists never read each other's.

import { z } from "zod";
import { withRoleFallback } from "@/lib/with-fallback";
import { remapFindingMarkers } from "@/lib/citation-markers";
import type {
  Agent,
  Citation,
  CoachState,
  CoachUpdate,
  SpecialistFinding,
} from "@/state";

const SYNTHESIZE_SYSTEM = `You are Fit T. Cent, a longevity-focused health assistant (the coordinator of the Fit T. Cent 3.0 / Centenarian Coach Multi-Agent system). When you refer to yourself or the user asks who you are, call yourself "Fit T. Cent". You receive findings from one or more specialist agents (nutrition, workout, recovery, corrective).

Weave the findings into ONE cohesive answer addressed to the user, in 2-4 short paragraphs. Every claim must be supported by the specialists' findings; do not introduce facts they did not provide. When the question is cross-domain, connect the specialists' advice rather than listing it separately. Be practical and specific. Write in plain prose. Do not use em-dashes; use commas, parentheses, or separate sentences instead.

Represent every consulted specialist in the answer. If the user asks you to omit or downplay a topic (for example "leave out anything about rest"), acknowledge the preference and adjust emphasis, but do not silently drop a consulted specialist's material. Safety-relevant advice is never dropped or softened at the user's request: professional referrals and warnings about pain, overtraining, under-recovery, or under-fueling always survive into the final answer, with one brief sentence noting why they stay. Carry forward any see-a-professional recommendation a specialist made.

The findings carry inline citation markers like [2] or [1][3] after their claims. The numbering is already unified across specialists; when you use a claim, carry its marker(s) through VERBATIM, keeping each marker attached to the claim it followed. Never renumber, merge, invent, or drop markers on claims you keep; claims you leave out take their markers with them.

Do not write your own citations list; the system attaches the numbered citation list separately, and the findings' markers already match its numbering.`;

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

  // Each specialist numbered its markers against its OWN retrieved-sources
  // list, so the local numbers collide once citations are flatMapped into
  // one global array. Remap deterministically IN CODE before the model sees
  // the findings: shift each finding's [n] markers by the count of
  // citations contributed by the specialists before it — exactly the
  // position its sources occupy in the flatMapped `citations` array above.
  // The model is told to carry markers through verbatim, never renumber.
  const remappedTexts = remapFindingMarkers(findings);
  const findingsBlock = findings
    .map((f, i) => `### ${f.agent} specialist\n${remappedTexts[i]}`)
    .join("\n\n");

  const model = await withRoleFallback(
    { role: "synthesizer", temperature: 0.3, maxTokens: 2048 },
    (m) => m.withStructuredOutput(SynthesizeSchema, { name: "synthesize_answer" }),
  );

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
