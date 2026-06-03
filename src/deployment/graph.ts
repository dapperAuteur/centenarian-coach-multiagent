// src/deployment/graph.ts
// Deployment entry for LangGraph Platform (LangSmith Deployment). It re-exports
// the compiled coach graph as the "coach" graph declared in langgraph.json.
//
// Why a dedicated entry instead of pointing langgraph.json straight at
// src/graph.ts: it isolates the single import the Platform build must resolve.
// The whole graph tree is imported through the "@/" path alias, and alias
// resolution inside the Platform Docker build is not guaranteed. If the build
// cannot resolve "@/graph", THIS is the one line to switch to a relative import
// ("../graph") or to wire a tsconfig-paths shim, see Module 5. Keeping it a
// pure re-export means the app, the tests, and the eval suite all keep
// exercising the exact same compiled graph.
export { coachGraph } from "@/graph";
