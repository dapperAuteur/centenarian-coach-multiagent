// src/graph.ts
// Top-level Centenarian Coach graph. Day 2: supervisor -> nutrition / workout.
// The supervisor may route to one specialist or both; the synthesizer node is
// Day 3. Recovery is v2.

import { StateGraph, START, END } from "@langchain/langgraph";
import { configureLangSmith } from "@/lib/langsmith";
import { CoachAnnotation, type CoachState } from "@/state";
import { supervisorNode } from "@/agents/supervisor/supervisor.node";
import { nutritionNode } from "@/agents/nutrition/subgraph";
import { workoutNode } from "@/agents/workout/subgraph";

// Enable LangSmith tracing (only when LANGSMITH_API_KEY is set) before the
// graph is constructed.
configureLangSmith();

// Fan-out: return every implemented specialist the supervisor chose. LangGraph
// runs them in parallel and their `findings` updates merge (object-merge
// reducer on the channel). Recovery is v2 and has no node yet — filtered out.
function routeToSpecialists(state: CoachState): string[] {
  const chosen = state.routing?.agents ?? [];
  const targets = chosen.filter(
    (agent): agent is "nutrition" | "workout" =>
      agent === "nutrition" || agent === "workout",
  );
  return targets.length > 0 ? targets : [END];
}

export const coachGraph = new StateGraph(CoachAnnotation)
  .addNode("supervisor", supervisorNode)
  .addNode("nutrition", nutritionNode)
  .addNode("workout", workoutNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeToSpecialists, [
    "nutrition",
    "workout",
    END,
  ])
  .addEdge("nutrition", END)
  .addEdge("workout", END)
  .compile();
