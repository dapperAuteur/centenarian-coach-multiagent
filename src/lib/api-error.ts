// src/lib/api-error.ts
// Shared error helpers for API route handlers. Every error response carries a
// short request id — echoed both in the JSON body and the `x-request-id`
// header — so a user can quote it and an operator can grep for it in the logs.
import { randomUUID } from "node:crypto";
import { redactText } from "@/lib/sentry-scrub";

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

/** What the browser sees for an unexpected failure. Pair it with the request id. */
export const GENERIC_ERROR_MESSAGE =
  "Something went wrong on our side. Please try again in a minute.";

/** What the coach chat shows when a model provider is rate-limited or overloaded. */
export const COACH_BUSY_MESSAGE =
  "The coach is busy right now. Please try again in a minute.";

/** What the coach chat shows for any other failure while answering. */
export const COACH_FAILED_MESSAGE =
  "The coach couldn't finish that answer. Please try again in a minute.";

/**
 * A log line for an unexpected error, run through the Sentry scrubber's text
 * redaction. A Drizzle failure's message is the SQL plus its parameters
 * ("Failed query: insert into "waitlist" ... params: visitor@example.com"), and
 * an LLM SDK error can echo the prompt, so the raw text must not reach the
 * browser and is redacted (emails, URLs, keys) before it reaches the logs.
 * Unwraps one level of `cause` (e.g. an Auth.js AdapterError around the real
 * failure) so the operator still sees the failure mode.
 */
export function describeErrorForLog(err: unknown): string {
  const describe = (e: unknown): string => {
    if (e instanceof Error) return e.stack ?? `${e.name}: ${e.message}`;
    if (typeof e === "string") return e;
    return "Unknown error (non-Error thrown)";
  };
  const cause = err instanceof Error ? err.cause : undefined;
  const detail =
    cause !== undefined && cause !== null
      ? `${describe(err)}\nCaused by: ${describe(cause)}`
      : describe(err);
  return redactText(detail);
}

/**
 * Log an unexpected error and return a 500 carrying its request id. Use in the
 * catch block of a route handler:
 *
 *   } catch (err) {
 *     return handleRouteError("coach/sessions", err, requestId);
 *   }
 *
 * The response body is `{ error: <generic message>, requestId }`: never the
 * error's own text. The detail goes to the server log only, redacted, under the
 * same request id, so a user who quotes the id can be matched to the cause.
 */
export function handleRouteError(
  scope: string,
  err: unknown,
  requestId: string,
  publicMessage: string = GENERIC_ERROR_MESSAGE,
): Response {
  console.error(
    `[${scope}] (requestId=${requestId}) ${describeErrorForLog(err)}`,
  );
  return apiError(500, publicMessage, requestId);
}

/**
 * The message the coach chat streams to the browser when a run fails. A
 * provider rate limit or overload (429, 503, 529, or an SDK error that says so)
 * gets the "busy" copy, since trying again later is the fix; anything else gets
 * the generic copy. Never the provider's or LangGraph's own error text.
 */
export function coachErrorMessage(err: unknown): string {
  const e = err as { status?: unknown; statusCode?: unknown; name?: unknown; message?: unknown } | null;
  const status =
    typeof e?.status === "number"
      ? e.status
      : typeof e?.statusCode === "number"
        ? e.statusCode
        : undefined;
  if (status === 429 || status === 503 || status === 529) return COACH_BUSY_MESSAGE;
  const text = `${typeof e?.name === "string" ? e.name : ""} ${
    typeof e?.message === "string" ? e.message : ""
  }`;
  if (/rate.?limit|too many requests|overloaded|quota|resource.?exhausted/i.test(text)) {
    return COACH_BUSY_MESSAGE;
  }
  return COACH_FAILED_MESSAGE;
}
