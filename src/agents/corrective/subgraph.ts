// src/agents/corrective/subgraph.ts
// The Corrective Exercise specialist as its own compiled StateGraph:
//   retrieve -> compose -> END
//
// Simpler than the other specialists because the v1 corrective agent has no
// tools (no wearable mocks; no calculator). Its state schema has no
// `findings` channel, so the Corrective graph physically cannot read other
// specialists' findings. The adapter `correctiveNode` runs the subgraph and
// maps the result onto the top-level CoachState.

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { withRoleFallback } from "@/lib/with-fallback";
import type {
  Citation,
  CoachState,
  CoachUpdate,
  SpecialistFinding,
  ToolCallRecord,
} from "@/state";
import { retrieveCorrectiveKb } from "./retrieval";
import { CORRECTIVE_COMPOSE_SYSTEM } from "./prompts";

const CorrectiveAnnotation = Annotation.Root({
  subQuestion: Annotation<string>(),
  citations: Annotation<Citation[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  toolCalls: Annotation<ToolCallRecord[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  draftText: Annotation<string>(),
});

type CorrectiveState = typeof CorrectiveAnnotation.State;
type CorrectiveUpdate = typeof CorrectiveAnnotation.Update;

/** Retrieve grounding documents from the corrective_kb namespace. */
async function retrieveNode(
  state: CorrectiveState,
): Promise<CorrectiveUpdate> {
  const citations = await retrieveCorrectiveKb(state.subQuestion, 5);
  return { citations };
}

const ComposeSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe(
      "The 2-3 paragraph corrective-exercise finding, grounded in the sources.",
    ),
});

/** Compose the grounded specialist finding text. */
async function composeNode(state: CorrectiveState): Promise<CorrectiveUpdate> {
  const sourcesBlock =
    state.citations.length > 0
      ? state.citations
          .map((c, i) => `[${i + 1}] ${c.source}\n${c.snippet}`)
          .join("\n\n")
      : "(no sources retrieved)";

  const model = await withRoleFallback(
    { role: "composer", temperature: 0.2, maxTokens: 2048 },
    (m) => m.withStructuredOutput(ComposeSchema, { name: "compose_finding" }),
  );
  const result = await model.invoke([
    { role: "system", content: CORRECTIVE_COMPOSE_SYSTEM },
    {
      role: "user",
      content: `Question: ${state.subQuestion}\n\nRetrieved sources:\n${sourcesBlock}`,
    },
  ]);
  return { draftText: result.text };
}

const correctiveSubgraph = new StateGraph(CorrectiveAnnotation)
  .addNode("retrieve", retrieveNode)
  .addNode("compose", composeNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "compose")
  .addEdge("compose", END)
  .compile();

/**
 * Adapter node for the top-level graph: runs the Corrective subgraph and
 * maps its output to a SpecialistFinding. Writes ONLY its own findings slot.
 */
export async function correctiveNode(
  state: CoachState,
): Promise<CoachUpdate> {
  const subQuestion =
    state.routing?.subQuestions.corrective ?? state.userQuery;
  const startedAt = Date.now();

  const result = await correctiveSubgraph.invoke({ subQuestion });

  const finding: SpecialistFinding = {
    agent: "corrective",
    text: result.draftText ?? "",
    citations: result.citations,
    toolCalls: result.toolCalls,
    durationMs: Date.now() - startedAt,
  };

  return { findings: { corrective: finding } };
}
