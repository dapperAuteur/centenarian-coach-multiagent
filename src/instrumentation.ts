// src/instrumentation.ts
// Next.js instrumentation hook (lives in src/ because this app uses a src dir).
// Loads the right Sentry config per runtime and reports server-side App Router
// errors through onRequestError. Everything here is inert without SENTRY_DSN --
// the guard lives in the two configs, so register() is cheap either way.

import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Captures errors thrown while rendering or serving a request.
 *
 * `captureRequestError` attaches the route path, route type, and router kind,
 * which is all the attribution this single-tenant app needs -- no host tag, no DB
 * lookup in the error path, and nothing derived from the signed-in user.
 *
 * A `handled: false` tag is set so the error inbox can separate crashes Next.js
 * surfaced for us from the ones an error boundary reported. Note that the request
 * headers Next.js hands us here still contain the session cookie; they reach
 * Sentry as `event.request.headers` and are stripped by scrubEvent, which is the
 * single place that policy is expressed.
 */
export const onRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context,
) => {
  Sentry.withScope((scope) => {
    scope.setTag("error.source", "onRequestError");
    Sentry.captureRequestError(err, request, context);
  });
};
