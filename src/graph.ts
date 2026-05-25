// src/graph.ts
// Top-level Centenarian Coach graph:
//   supervisor -> (nutrition / workout / recovery / corrective, fan-out) ->
//   synthesize -> END

import { StateGraph, START, END } from "@langchain/langgraph";
import { configureLangSmith } from "@/lib/langsmith";
import { CoachAnnotation, type CoachState, type Agent } from "@/state";
import { supervisorNode } from "@/agents/supervisor/supervisor.node";
import { nutritionNode } from "@/agents/nutrition/subgraph";
import { workoutNode } from "@/agents/workout/subgraph";
import { recoveryNode } from "@/agents/recovery/subgraph";
import { correctiveNode } from "@/agents/corrective/subgraph";
import { synthesizeNode } from "@/synthesizer/synthesize";

// Enable LangSmith tracing (only when LANGSMITH_API_KEY is set) before the
// graph is constructed.
configureLangSmith();

// Every agent in the routing union is an implemented specialist node.
const SPECIALISTS: readonly Agent[] = [
  "nutrition",
  "workout",
  "recovery",
  "corrective",
];

// Fan-out: return every specialist the supervisor chose. LangGraph runs them
// in parallel; their `findings` updates merge (object-merge reducer on the
// channel). They then fan back in to the synthesizer. If nothing was
// selected, go straight to the synthesizer (it emits a graceful "no
// specialist" answer).
function routeToSpecialists(state: CoachState): string[] {
  const chosen = state.routing?.agents ?? [];
  const targets = chosen.filter((agent) => SPECIALISTS.includes(agent));
  return targets.length > 0 ? targets : ["synthesize"];
}

export const coachGraph = new StateGraph(CoachAnnotation)
  .addNode("supervisor", supervisorNode)
  .addNode("nutrition", nutritionNode)
  .addNode("workout", workoutNode)
  .addNode("recovery", recoveryNode)
  .addNode("corrective", correctiveNode)
  .addNode("synthesize", synthesizeNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeToSpecialists, [
    "nutrition",
    "workout",
    "recovery",
    "corrective",
    "synthesize",
  ])
  .addEdge("nutrition", "synthesize")
  .addEdge("workout", "synthesize")
  .addEdge("recovery", "synthesize")
  .addEdge("corrective", "synthesize")
  .addEdge("synthesize", END)
  .compile();
