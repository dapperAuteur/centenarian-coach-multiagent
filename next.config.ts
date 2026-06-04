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
  // The app logo is served from Cloudinary (CDN-optimized), so allowlist the host
  // for next/image.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
