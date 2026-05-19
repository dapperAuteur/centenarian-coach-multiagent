import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LangChain / LangGraph are server-only and CommonJS-heavy. Keep them out of
  // the bundler so the coach API routes import them as-is at runtime.
  serverExternalPackages: [
    "@langchain/langgraph",
    "@langchain/core",
    "@langchain/anthropic",
    "langsmith",
  ],
};

export default nextConfig;
