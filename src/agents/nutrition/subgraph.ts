// src/agents/nutrition/subgraph.ts
// The Nutrition specialist as its own compiled StateGraph:
//   retrieve -> assess -> (tools | compose) -> compose -> END
//
// Its state schema has no `findings` channel — the Nutrition graph physically
// cannot read other specialists' findings. The adapter `nutritionNode` runs
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
import { retrieveNutritionKb } from "./retrieval";
import {
  calorieCalculator,
  CalorieInputSchema,
  type CalorieInput,
} from "./tools/calorieCalculator";
import { NUTRITION_ASSESS_SYSTEM, NUTRITION_COMPOSE_SYSTEM } from "./prompts";

const NutritionAnnotation = Annotation.Root({
  subQuestion: Annotation<string>(),
  citations: Annotation<Citation[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  toolCalls: Annotation<ToolCallRecord[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  needsCalorieTool: Annotation<boolean>(),
  calorieArgs: Annotation<CalorieInput | null>(),
  draftText: Annotation<string>(),
});

type NutritionState = typeof NutritionAnnotation.State;
type NutritionUpdate = typeof NutritionAnnotation.Update;

/** Retrieve grounding documents from the nutrition_kb namespace. */
async function retrieveNode(state: NutritionState): Promise<NutritionUpdate> {
  const citations = await retrieveNutritionKb(state.subQuestion, 5);
  return { citations };
}

const AssessSchema = z.object({
  needsCalorieTool: z
    .boolean()
    .describe(
      "True only if the question supplies sex, age, weight (kg), height (cm), and activity level.",
    ),
  calorieArgs: CalorieInputSchema.nullable().describe(
    "Extracted calorie-calculator inputs, or null when needsCalorieTool is false.",
  ),
});

/** Decide whether the calorie_calculator tool should run. */
async function assessNode(state: NutritionState): Promise<NutritionUpdate> {
  const model = await withRoleFallback(
    { role: "composer", temperature: 0 },
    (m) => m.withStructuredOutput(AssessSchema, { name: "assess_tools" }),
  );
  const result = await model.invoke([
    { role: "system", content: NUTRITION_ASSESS_SYSTEM },
    { role: "user", content: state.subQuestion },
  ]);
  return {
    needsCalorieTool: result.needsCalorieTool,
    calorieArgs: result.calorieArgs,
  };
}

/** Invoke the wired calorie_calculator tool and record the call. */
async function toolsNode(state: NutritionState): Promise<NutritionUpdate> {
  if (!state.calorieArgs) {
    return {};
  }
  const output: unknown = await calorieCalculator.invoke(state.calorieArgs);
  const record: ToolCallRecord = {
    name: calorieCalculator.name,
    input: state.calorieArgs,
    output,
  };
  return { toolCalls: [record] };
}

const ComposeSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe("The 2-3 paragraph nutrition finding, grounded in the sources."),
});

/** Compose the grounded specialist finding text. */
async function composeNode(state: NutritionState): Promise<NutritionUpdate> {
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

  // Extra token headroom: the structured-output block carries the full
  // 2-3 paragraph answer.
  const model = await withRoleFallback(
    { role: "composer", temperature: 0.2, maxTokens: 2048 },
    (m) => m.withStructuredOutput(ComposeSchema, { name: "compose_finding" }),
  );
  const result = await model.invoke([
    { role: "system", content: NUTRITION_COMPOSE_SYSTEM },
    {
      role: "user",
      content: `Question: ${state.subQuestion}\n\nRetrieved sources:\n${sourcesBlock}\n\nTool results:\n${toolBlock}`,
    },
  ]);
  return { draftText: result.text };
}

const nutritionSubgraph = new StateGraph(NutritionAnnotation)
  .addNode("retrieve", retrieveNode)
  .addNode("assess", assessNode)
  .addNode("tools", toolsNode)
  .addNode("compose", composeNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "assess")
  .addConditionalEdges(
    "assess",
    (state) =>
      state.needsCalorieTool && state.calorieArgs ? "tools" : "compose",
    { tools: "tools", compose: "compose" },
  )
  .addEdge("tools", "compose")
  .addEdge("compose", END)
  .compile();

/**
 * Adapter node for the top-level graph: runs the Nutrition subgraph and maps
 * its output to a SpecialistFinding. Writes ONLY its own findings slot.
 */
export async function nutritionNode(state: CoachState): Promise<CoachUpdate> {
  const subQuestion = state.routing?.subQuestions.nutrition ?? state.userQuery;
  const startedAt = Date.now();

  const result = await nutritionSubgraph.invoke({ subQuestion });

  const finding: SpecialistFinding = {
    agent: "nutrition",
    text: result.draftText ?? "",
    citations: result.citations,
    toolCalls: result.toolCalls,
    durationMs: Date.now() - startedAt,
  };

  return { findings: { nutrition: finding } };
}
