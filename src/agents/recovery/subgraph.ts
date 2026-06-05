// src/agents/recovery/subgraph.ts
// The Recovery specialist as its own compiled StateGraph:
//   retrieve -> assess -> (tools | compose) -> compose -> END
//
// Its state schema has no `findings` channel — the Recovery graph physically
// cannot read other specialists' findings. The adapter `recoveryNode` runs
// the subgraph and maps the result onto the top-level CoachState.

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
import { retrieveRecoveryKb } from "./retrieval";
import {
  sleepDataMock,
  SleepDataInputSchema,
  type SleepDataInput,
} from "./tools/sleepDataMock";
import {
  hrvTrendMock,
  HrvTrendInputSchema,
  type HrvTrendInput,
} from "./tools/hrvTrendMock";
import { RECOVERY_ASSESS_SYSTEM, RECOVERY_COMPOSE_SYSTEM } from "./prompts";

const RecoveryAnnotation = Annotation.Root({
  subQuestion: Annotation<string>(),
  // The user's original wording, retrieved alongside the sub-question to widen
  // recall (see retrieveNode). Optional; falls back to the sub-question.
  userQuery: Annotation<string>(),
  citations: Annotation<Citation[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  toolCalls: Annotation<ToolCallRecord[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  sleepArgs: Annotation<SleepDataInput | null>(),
  hrvArgs: Annotation<HrvTrendInput | null>(),
  draftText: Annotation<string>(),
});

type RecoveryState = typeof RecoveryAnnotation.State;
type RecoveryUpdate = typeof RecoveryAnnotation.Update;

/** Retrieve grounding documents from the recovery_kb namespace. */
async function retrieveNode(state: RecoveryState): Promise<RecoveryUpdate> {
  const citations = await retrieveRecoveryKb(
    state.subQuestion,
    8,
    state.userQuery,
  );
  return { citations };
}

const AssessSchema = z.object({
  sleepArgs: SleepDataInputSchema.nullable().describe(
    "sleep_data_mock inputs, or null when the question is not about sleep or rest quality.",
  ),
  hrvArgs: HrvTrendInputSchema.nullable().describe(
    "hrv_trend_mock inputs, or null when the question is not about HRV or readiness.",
  ),
});

/** Decide which recovery tools (if any) should run. */
async function assessNode(state: RecoveryState): Promise<RecoveryUpdate> {
  const model = await withRoleFallback(
    { role: "composer", temperature: 0 },
    (m) =>
      m.withStructuredOutput(AssessSchema, { name: "assess_recovery_tools" }),
  );
  const result = await model.invoke([
    { role: "system", content: RECOVERY_ASSESS_SYSTEM },
    { role: "user", content: state.subQuestion },
  ]);
  return { sleepArgs: result.sleepArgs, hrvArgs: result.hrvArgs };
}

/** Invoke whichever recovery tools the assess node selected. */
async function toolsNode(state: RecoveryState): Promise<RecoveryUpdate> {
  const toolCalls: ToolCallRecord[] = [];
  if (state.sleepArgs) {
    const output: unknown = await sleepDataMock.invoke(state.sleepArgs);
    toolCalls.push({
      name: sleepDataMock.name,
      input: state.sleepArgs,
      output,
    });
  }
  if (state.hrvArgs) {
    const output: unknown = await hrvTrendMock.invoke(state.hrvArgs);
    toolCalls.push({ name: hrvTrendMock.name, input: state.hrvArgs, output });
  }
  return { toolCalls };
}

const ComposeSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe("The 2-3 paragraph recovery finding, grounded in the sources."),
});

/** Compose the grounded specialist finding text. */
async function composeNode(state: RecoveryState): Promise<RecoveryUpdate> {
  const sourcesBlock =
    state.citations.length > 0
      ? state.citations
          .map((c, i) => `[${i + 1}] ${c.source}\n${c.snippet}`)
          .join("\n\n")
      : "(no sources retrieved)";
  const toolBlock =
    state.toolCalls.length > 0
      ? state.toolCalls
          .map((t) => `${t.name} -> ${JSON.stringify(t.output)}`)
          .join("\n")
      : "(no tools used)";

  const model = await withRoleFallback(
    { role: "composer", temperature: 0.2, maxTokens: 2048 },
    (m) => m.withStructuredOutput(ComposeSchema, { name: "compose_finding" }),
  );
  const result = await model.invoke([
    { role: "system", content: RECOVERY_COMPOSE_SYSTEM },
    {
      role: "user",
      content: `Question: ${state.subQuestion}\n\nRetrieved sources:\n${sourcesBlock}\n\nTool results:\n${toolBlock}`,
    },
  ]);
  return { draftText: result.text };
}

const recoverySubgraph = new StateGraph(RecoveryAnnotation)
  .addNode("retrieve", retrieveNode)
  .addNode("assess", assessNode)
  .addNode("tools", toolsNode)
  .addNode("compose", composeNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "assess")
  .addConditionalEdges(
    "assess",
    (state) => (state.sleepArgs || state.hrvArgs ? "tools" : "compose"),
    { tools: "tools", compose: "compose" },
  )
  .addEdge("tools", "compose")
  .addEdge("compose", END)
  .compile();

/**
 * Adapter node for the top-level graph: runs the Recovery subgraph and maps
 * its output to a SpecialistFinding. Writes ONLY its own findings slot.
 */
export async function recoveryNode(state: CoachState): Promise<CoachUpdate> {
  const subQuestion = state.routing?.subQuestions.recovery ?? state.userQuery;
  const startedAt = Date.now();

  const result = await recoverySubgraph.invoke({
    subQuestion,
    userQuery: state.userQuery,
  });

  const finding: SpecialistFinding = {
    agent: "recovery",
    text: result.draftText ?? "",
    citations: result.citations,
    toolCalls: result.toolCalls,
    durationMs: Date.now() - startedAt,
  };

  return { findings: { recovery: finding } };
}
