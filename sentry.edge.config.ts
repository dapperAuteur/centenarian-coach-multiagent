// sentry.edge.config.ts
// Edge-runtime error monitoring (middleware.ts and any edge route), loaded by
// src/instrumentation.ts's register(). Same DSN guard and same privacy posture as
// the server config: inert with no SENTRY_DSN.
//
// The edge runtime here is the Auth.js session gate in middleware.ts, so an event
// from this runtime is the most likely place a session cookie or a magic-link
// callback URL would show up. Both are handled by scrubEvent.

import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
