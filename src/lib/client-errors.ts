// src/lib/client-errors.ts
// Client-side helper: turn a failed fetch Response into a friendly message plus
// the server's request id. Reads the standardized `{ error, requestId }` body
// (see lib/api-error.ts) and falls back to the `x-request-id` header and the
// status code when the body is missing or not JSON.

export interface ClientApiError {
  message: string;
  requestId?: string;
}

export async function extractApiError(res: Response): Promise<ClientApiError> {
  let body: { error?: string; requestId?: string } = {};
  try {
    body = (await res.json()) as { error?: string; requestId?: string };
  } catch {
    // Non-JSON body — fall through to the status-based message.
  }
  const requestId =
    body.requestId ?? res.headers.get("x-request-id") ?? undefined;
  const message = body.error?.trim() || `Request failed (${res.status})`;
  return { message, requestId };
}
