// src/graph.ts
// Top-level Centenarian Coach graph. Day 1: supervisor -> nutrition.
// Workout/Recovery branches are added later without touching shared state or
// the supervisor.

import { StateGraph, START, END } from "@langchain/langgraph";
import { configureLangSmith } from "@/lib/langsmith";
import { CoachAnnotation } from "@/state";
import { supervisorNode } from "@/agents/supervisor/supervisor.node";
import { nutritionNode } from "@/agents/nutrition/subgraph";

// Enable LangSmith tracing (only when LANGSMITH_API_KEY is set) before the
// graph is constructed.
configureLangSmith();

export const coachGraph = new StateGraph(CoachAnnotation)
  .addNode("supervisor", supervisorNode)
  .addNode("nutrition", nutritionNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges(
    "supervisor",
    (state) =>
      state.routing?.agents.includes("nutrition") ? "nutrition" : END,
    { nutrition: "nutrition", [END]: END },
  )
  .addEdge("nutrition", END)
  .compile();
