// src/graph.ts
// Top-level Centenarian Coach graph (Day 3):
//   supervisor -> (nutrition / workout, fan-out) -> synthesize -> END
// Recovery is v2.

import { StateGraph, START, END } from "@langchain/langgraph";
import { configureLangSmith } from "@/lib/langsmith";
import { CoachAnnotation, type CoachState } from "@/state";
import { supervisorNode } from "@/agents/supervisor/supervisor.node";
import { nutritionNode } from "@/agents/nutrition/subgraph";
import { workoutNode } from "@/agents/workout/subgraph";
import { synthesizeNode } from "@/synthesizer/synthesize";

// Enable LangSmith tracing (only when LANGSMITH_API_KEY is set) before the
// graph is constructed.
configureLangSmith();

// Fan-out: return every implemented specialist the supervisor chose. LangGraph
// runs them in parallel; their `findings` updates merge (object-merge reducer
// on the channel). They then fan back in to the synthesizer. Recovery is v2
// and has no node yet — filtered out. If nothing was selected, go straight to
// the synthesizer (it emits a graceful "no specialist" answer).
function routeToSpecialists(state: CoachState): string[] {
  const chosen = state.routing?.agents ?? [];
  const targets = chosen.filter(
    (agent): agent is "nutrition" | "workout" =>
      agent === "nutrition" || agent === "workout",
  );
  return targets.length > 0 ? targets : ["synthesize"];
}

export const coachGraph = new StateGraph(CoachAnnotation)
  .addNode("supervisor", supervisorNode)
  .addNode("nutrition", nutritionNode)
  .addNode("workout", workoutNode)
  .addNode("synthesize", synthesizeNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeToSpecialists, [
    "nutrition",
    "workout",
    "synthesize",
  ])
  .addEdge("nutrition", "synthesize")
  .addEdge("workout", "synthesize")
  .addEdge("synthesize", END)
  .compile();
