// src/app/api/coach/query/route.ts
// POST /api/coach/query — runs the multi-agent coach graph and streams
// intermediate events as newline-delimited JSON (NDJSON):
//   { type: "session", sessionId }
//   { type: "routing", routing }          — which specialists will be consulted
//   { type: "finding", finding }           — one per specialist as it completes
//   { type: "answer",  finalAnswer }       — the synthesized answer + citations
//   { type: "done", langsmithRunId } | { type: "error", message }
//
// The graph run is named "centenarian-coach" and tagged for LangSmith. When
// tracing is enabled, the root run id is captured and returned so the UI can
// link to the trace.

import { randomUUID } from "node:crypto";
import { RunCollectorCallbackHandler } from "@langchain/core/tracers/run_collector";
import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { coachGraph } from "@/graph";
import { setTracing } from "@/lib/langsmith";
import { getSettings } from "@/lib/settings";
import { persistSession } from "@/lib/sessions";
import type {
  CoachState,
  FinalAnswer,
  FindingsMap,
  RoutingDecision,
} from "@/state";
import { apiError, newRequestId } from "@/lib/api-error";

export const runtime = "nodejs";
export const maxDuration = 60;

interface QueryBody {
  userQuery?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  const requestId = newRequestId();
  let body: QueryBody = {};
  try {
    body = (await req.json()) as QueryBody;
  } catch {
    // invalid/empty body — handled by the validation below
  }
  const userQuery =
    typeof body.userQuery === "string" ? body.userQuery.trim() : "";
  if (!userQuery) {
    return apiError(400, "userQuery is required", requestId);
  }

  const sessionId = randomUUID();
  // Tracing follows the dashboard toggle (and only runs with an API key).
  const settings = await getSettings();
  const tracingEnabled = setTracing(settings.tracingEnabled);
  const runCollector = new RunCollectorCallbackHandler();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: "session", sessionId });

        // Accumulated as the stream runs, then persisted once it completes so
        // the run can be reviewed later at /coach/history.
        let routing: RoutingDecision | undefined;
        const findings: FindingsMap = {};
        let finalAnswer: FinalAnswer | undefined;

        const events = await coachGraph.stream(
          { sessionId, userQuery },
          {
            streamMode: "updates",
            callbacks: [runCollector],
            runName: "centenarian-coach",
            // Tags + metadata so LangSmith dashboards/evaluators can group by
            // the active provider and corpus mode (the two /admin levers).
            tags: [
              "coach",
              `provider:${settings.provider}`,
              `corpus:${settings.corpusMode}`,
            ],
            metadata: {
              sessionId,
              provider: settings.provider,
              corpusMode: settings.corpusMode,
            },
          },
        );
        for await (const chunk of events) {
          for (const [node, value] of Object.entries(
            chunk as Record<string, Partial<CoachState>>,
          )) {
            if (node === "supervisor" && value.routing) {
              routing = value.routing;
              send({ type: "routing", routing: value.routing });
            } else if (
              (node === "nutrition" ||
                node === "workout" ||
                node === "recovery") &&
              value.findings
            ) {
              const finding = value.findings[node];
              if (finding) {
                findings[node] = finding;
                send({ type: "finding", finding });
              }
            } else if (node === "synthesize" && value.finalAnswer) {
              finalAnswer = value.finalAnswer;
              send({ type: "answer", finalAnswer: value.finalAnswer });
            }
          }
        }

        // Flush tracer callbacks so the run uploads to LangSmith before this
        // (serverless) function returns. On Vercel, background callback uploads
        // can be dropped when the function freezes after the response ends, so
        // traces silently never appear even with a valid key.
        if (tracingEnabled) {
          await awaitAllCallbacks();
        }

        // The root run is the named "centenarian-coach" run. Only meaningful
        // as a LangSmith link when tracing is enabled.
        const langsmithRunId = tracingEnabled
          ? (runCollector.tracedRuns[0]?.id ?? null)
          : null;

        // Persist the completed run. Best-effort: a DB failure must not break
        // the response the user already received.
        try {
          await persistSession({
            sessionId,
            query: userQuery,
            routing: routing ?? null,
            findings,
            finalAnswer: finalAnswer ?? null,
            langsmithRunId,
          });
        } catch (persistErr) {
          console.error("Failed to persist coach session:", persistErr);
        }

        send({ type: "done", langsmithRunId });
      } catch (err) {
        console.error(`[coach/query] (requestId=${requestId})`, err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
          requestId,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}
