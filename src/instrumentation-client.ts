// src/instrumentation-client.ts
// Browser-runtime error monitoring. Runs after the document loads and before
// React hydration, so it catches errors from the very first paint of /coach.
//
// Reads the PUBLIC DSN, which is inlined at build time. Guarded the same way as
// the server config: with no NEXT_PUBLIC_SENTRY_DSN the SDK is never initialised,
// nothing is sent, and nothing changes for users.
//
// NOTE ON CSP: this repo ships no Content-Security-Policy today (no `headers()` in
// next.config.ts, none in middleware.ts, no vercel.json). If one is ever added, a
// restrictive `connect-src` must be widened by the DSN's ORIGIN ONLY -- and only
// when a DSN is actually set -- or the SDK's POSTs to the ingest endpoint are
// silently blocked by the browser and the inbox looks reassuringly empty.

import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Errors only. No tracing, and no session replay ever on this app: a replay
    // of /coach is a video of somebody typing their symptoms.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

/** Instruments App Router client navigations. A no-op when init was skipped. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
