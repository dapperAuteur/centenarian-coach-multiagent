// src/lib/api-error.ts
// Shared error helpers for API route handlers. Every error response carries a
// short request id — echoed both in the JSON body and the `x-request-id`
// header — so a user can quote it and an operator can grep for it in the logs.
import { randomUUID } from "node:crypto";

export interface ApiErrorBody {
  error: string;
  requestId: string;
  // Optional extra fields (e.g. Zod issues) merged in by the caller.
  [key: string]: unknown;
}

/** Mint a short request id for correlating a response with server logs. */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Build a JSON error Response with a consistent shape —
 * `{ error, requestId, ...extra }` — plus an `x-request-id` header.
 */
export function apiError(
  status: number,
  message: string,
  requestId: string,
  extra?: Record<string, unknown>,
): Response {
  const body: ApiErrorBody = { error: message, requestId, ...extra };
  return Response.json(body, {
    status,
    headers: { "x-request-id": requestId },
  });
}

/**
 * Log an unexpected error and return a 500 carrying its request id. Use in the
 * catch block of a route handler:
 *
 *   } catch (err) {
 *     return handleRouteError("coach/sessions", err, requestId);
 *   }
 *
 * Unwraps one level of `cause` (e.g. an Auth.js AdapterError) into the message,
 * matching the detail the access-request route surfaced before this helper.
 */
export function handleRouteError(
  scope: string,
  err: unknown,
  requestId: string,
): Response {
  const errorObj = err as (Error & { cause?: unknown }) | undefined;
  const cause = errorObj?.cause;
  const causeMessage = cause instanceof Error ? cause.message : undefined;
  const message =
    errorObj instanceof Error
      ? causeMessage
        ? `${errorObj.message}: ${causeMessage}`
        : errorObj.message
      : "Unknown error";
  console.error(
    `[${scope}] (requestId=${requestId})`,
    errorObj ?? err,
    cause ?? "",
  );
  return apiError(500, message, requestId);
}
