// src/lib/langsmith.ts
// LangSmith tracing gate. Tracing is on by default, but only actually enabled
// when LANGSMITH_API_KEY is present — with no key this is a clean no-op and the
// graph still runs (fail-soft). Call configureLangSmith() once before building
// any graph.

let configured = false;

export interface LangSmithStatus {
  enabled: boolean;
}

export function configureLangSmith(): LangSmithStatus {
  if (!configured) {
    configured = true;
    const key = process.env.LANGSMITH_API_KEY;
    if (key) {
      // LangChain reads both the LANGSMITH_* and legacy LANGCHAIN_* names.
      process.env.LANGSMITH_TRACING = "true";
      process.env.LANGCHAIN_TRACING_V2 = "true";
      if (!process.env.LANGSMITH_PROJECT) {
        process.env.LANGSMITH_PROJECT = "centenarian-coach-multiagent";
      }
    } else {
      // Hard-disable so a stray tracing flag never half-enables tracing
      // without a key (which would emit noisy warnings on every run).
      process.env.LANGSMITH_TRACING = "false";
      process.env.LANGCHAIN_TRACING_V2 = "false";
    }
  }
  return { enabled: process.env.LANGSMITH_TRACING === "true" };
}
