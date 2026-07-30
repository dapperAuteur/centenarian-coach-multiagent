// sentry.server.config.ts
// Node-runtime error monitoring, loaded by src/instrumentation.ts's register().
//
// The DSN points at Better Stack, which speaks the Sentry ingest protocol, so the
// vendor-neutral @sentry/nextjs SDK is the client. Env var names stay SENTRY_DSN /
// SENTRY_ENVIRONMENT because that is what the SDK reads and what the rest of the
// witus ecosystem uses; the value comes from the Better Stack source, not sentry.io.
//
// GUARDED ON THE DSN: with no SENTRY_DSN set, init() is never called and the SDK
// is completely inert, so the app ships and runs unchanged until BAM provisions
// the source and sets the var (see plans/user-tasks).

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
    // Errors only. Tracing on a coach run would span the supervisor, four
    // specialist subgraphs, and every retrieval call, and span names/attributes
    // are one more place a prompt can hitch a ride. LangSmith already owns
    // request-level observability for the graph, so there is nothing to gain and
    // a privacy surface to lose.
    tracesSampleRate: 0,
    // Session replay is OFF and stays off: a replay of /coach is a video of
    // somebody typing their symptoms and reading advice about them.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Never auto-attach IP, cookies, headers, or user identity. beforeSend is the
    // second line of defense, not the first.
    sendDefaultPii: false,
    // Local variables would capture `userQuery` / `findingText` verbatim. Off by
    // default in the SDK; pinned here so a future default flip cannot leak.
    includeLocalVariables: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
