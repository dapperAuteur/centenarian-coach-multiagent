import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

// Wrap with Sentry's build plugin. Safe with no Sentry env set: without
// SENTRY_AUTH_TOKEN it skips source-map upload entirely (you just get minified
// stack traces), and the runtime SDK stays inert without a DSN. org/project/token
// all come from env so nothing vendor-specific or secret is committed here.
//
// Two things worth knowing about this repo specifically:
//   * It builds with TURBOPACK (the Next 16 default -- see the build banner), so
//     the `webpack` options below no-op today. They are still correct to declare:
//     they cost nothing and they apply the moment a build runs with --webpack.
//   * `removeDebugLogging` is the current option name;
//     the top-level `disableLogger` it replaced is deprecated in @sentry/nextjs 10.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      // Strip the SDK's own debug logging from the client bundle.
      removeDebugLogging: true,
    },
  },
});
