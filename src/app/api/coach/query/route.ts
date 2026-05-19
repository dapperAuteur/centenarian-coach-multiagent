// src/app/api/coach/query/route.ts
// POST /api/coach/query — runs the multi-agent coach graph and streams
// intermediate events as newline-delimited JSON (NDJSON):
//   { type: "session", sessionId }
//   { type: "routing", routing }          — which specialists will be consulted
//   { type: "finding", finding }           — one per specialist as it completes
//   { type: "answer",  finalAnswer }       — the synthesized answer + citations
//   { type: "done" } | { type: "error", message }

import { randomUUID } from "node:crypto";
import { coachGraph } from "@/graph";
import type { CoachState } from "@/state";

export const runtime = "nodejs";
export const maxDuration = 60;

interface QueryBody {
  userQuery?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  let body: QueryBody = {};
  try {
    body = (await req.json()) as QueryBody;
  } catch {
    // invalid/empty body — handled by the validation below
  }
  const userQuery =
    typeof body.userQuery === "string" ? body.userQuery.trim() : "";
  if (!userQuery) {
    return new Response(JSON.stringify({ error: "userQuery is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const sessionId = randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: "session", sessionId });

        const events = await coachGraph.stream(
          { sessionId, userQuery },
          { streamMode: "updates" },
        );
        for await (const chunk of events) {
          for (const [node, value] of Object.entries(
            chunk as Record<string, Partial<CoachState>>,
          )) {
            if (node === "supervisor" && value.routing) {
              send({ type: "routing", routing: value.routing });
            } else if (
              (node === "nutrition" || node === "workout") &&
              value.findings
            ) {
              const finding = value.findings[node];
              if (finding) send({ type: "finding", finding });
            } else if (node === "synthesize" && value.finalAnswer) {
              send({ type: "answer", finalAnswer: value.finalAnswer });
            }
          }
        }
        send({ type: "done" });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
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
    },
  });
}
