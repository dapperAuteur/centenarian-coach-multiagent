// src/agents/workout/subgraph.ts
// The Workout specialist as its own compiled StateGraph:
//   retrieve -> assess -> (tools | compose) -> compose -> END
//
// Its state schema has no `findings` channel — the Workout graph physically
// cannot read other specialists' findings. The adapter `workoutNode` runs the
// subgraph and maps the result onto the top-level CoachState.

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
import { retrieveWorkoutKb } from "./retrieval";
import {
  suggestProgression,
  ProgressionInputSchema,
  type ProgressionInput,
} from "./tools/suggestProgression";
import {
  mobilityLookup,
  MobilityInputSchema,
  type MobilityInput,
} from "./tools/mobilityLookup";
import { WORKOUT_ASSESS_SYSTEM, WORKOUT_COMPOSE_SYSTEM } from "./prompts";

const WorkoutAnnotation = Annotation.Root({
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
  progressionArgs: Annotation<ProgressionInput | null>(),
  mobilityArgs: Annotation<MobilityInput | null>(),
  draftText: Annotation<string>(),
});

type WorkoutState = typeof WorkoutAnnotation.State;
type WorkoutUpdate = typeof WorkoutAnnotation.Update;

/** Retrieve grounding documents from the workout_kb namespace. */
async function retrieveNode(state: WorkoutState): Promise<WorkoutUpdate> {
  const citations = await retrieveWorkoutKb(state.subQuestion, 8, state.userQuery);
  return { citations };
}

const AssessSchema = z.object({
  progressionArgs: ProgressionInputSchema.nullable().describe(
    "suggest_progression inputs, or null when the question lacks exercise/weight/reps/goal.",
  ),
  mobilityArgs: MobilityInputSchema.nullable().describe(
    "mobility_lookup inputs, or null when the question is not about a body area's mobility.",
  ),
});

/** Decide which workout tools (if any) should run. */
async function assessNode(state: WorkoutState): Promise<WorkoutUpdate> {
  const model = await withRoleFallback(
    { role: "composer", temperature: 0 },
    (m) =>
      m.withStructuredOutput(AssessSchema, { name: "assess_workout_tools" }),
  );
  const result = await model.invoke([
    { role: "system", content: WORKOUT_ASSESS_SYSTEM },
    { role: "user", content: state.subQuestion },
  ]);
  return {
    progressionArgs: result.progressionArgs,
    mobilityArgs: result.mobilityArgs,
  };
}

/** Invoke whichever workout tools the assess node selected. */
async function toolsNode(state: WorkoutState): Promise<WorkoutUpdate> {
  const toolCalls: ToolCallRecord[] = [];
  if (state.progressionArgs) {
    const output: unknown = await suggestProgression.invoke(
      state.progressionArgs,
    );
    toolCalls.push({
      name: suggestProgression.name,
      input: state.progressionArgs,
      output,
    });
  }
  if (state.mobilityArgs) {
    const output: unknown = await mobilityLookup.invoke(state.mobilityArgs);
    toolCalls.push({
      name: mobilityLookup.name,
      input: state.mobilityArgs,
      output,
    });
  }
  return { toolCalls };
}

const ComposeSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe("The 2-3 paragraph workout finding, grounded in the sources."),
});

/** Compose the grounded specialist finding text. */
async function composeNode(state: WorkoutState): Promise<WorkoutUpdate> {
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
    { role: "system", content: WORKOUT_COMPOSE_SYSTEM },
    {
      role: "user",
      content: `Question: ${state.subQuestion}\n\nRetrieved sources:\n${sourcesBlock}\n\nTool results:\n${toolBlock}`,
    },
  ]);
  return { draftText: result.text };
}

const workoutSubgraph = new StateGraph(WorkoutAnnotation)
  .addNode("retrieve", retrieveNode)
  .addNode("assess", assessNode)
  .addNode("tools", toolsNode)
  .addNode("compose", composeNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "assess")
  .addConditionalEdges(
    "assess",
    (state) =>
      state.progressionArgs || state.mobilityArgs ? "tools" : "compose",
    { tools: "tools", compose: "compose" },
  )
  .addEdge("tools", "compose")
  .addEdge("compose", END)
  .compile();

/**
 * Adapter node for the top-level graph: runs the Workout subgraph and maps its
 * output to a SpecialistFinding. Writes ONLY its own findings slot.
 */
export async function workoutNode(state: CoachState): Promise<CoachUpdate> {
  const subQuestion = state.routing?.subQuestions.workout ?? state.userQuery;
  const startedAt = Date.now();

  const result = await workoutSubgraph.invoke({
    subQuestion,
    userQuery: state.userQuery,
  });

  const finding: SpecialistFinding = {
    agent: "workout",
    text: result.draftText ?? "",
    citations: result.citations,
    toolCalls: result.toolCalls,
    durationMs: Date.now() - startedAt,
  };

  return { findings: { workout: finding } };
}
