// tests/api-error.test.ts
// No raw error text reaches the browser.
//
// The audit of 2026-11-06 (witus plans/40, finding 8) found handleRouteError
// returning `err.message: cause.message` to the client. On the public waitlist
// a Drizzle failure is "Failed query: insert into "waitlist" ... params:
// <the visitor's email>", and the coach chat streamed the raw provider error.
// The load-bearing assertions are the negative ones: the body never carries
// the SQL, the email, or the provider text, and the log line is redacted.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  COACH_BUSY_MESSAGE,
  COACH_FAILED_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  coachErrorMessage,
  describeErrorForLog,
  handleRouteError,
} from "@/lib/api-error";

const EMAIL = "visitor@example.com";
const DRIZZLE_TEXT = `Failed query: insert into "waitlist" ("email") values ($1) on conflict do nothing\nparams: ${EMAIL}`;

function drizzleError(): Error {
  const err = new Error(DRIZZLE_TEXT);
  (err as Error & { cause?: unknown }).cause = new Error(
    'relation "waitlist" does not exist',
  );
  return err;
}

let logged: string[] = [];

beforeEach(() => {
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleRouteError", () => {
  it("returns a generic message and the request id, never the error text", async () => {
    const res = handleRouteError("waitlist", drizzleError(), "req-123");
    expect(res.status).toBe(500);
    expect(res.headers.get("x-request-id")).toBe("req-123");

    const raw = await res.text();
    expect(raw).not.toContain(EMAIL);
    expect(raw).not.toContain("Failed query");
    expect(raw).not.toContain("waitlist");
    expect(raw).not.toContain("does not exist");
    expect(JSON.parse(raw)).toEqual({
      error: GENERIC_ERROR_MESSAGE,
      requestId: "req-123",
    });
  });

  it("takes a specific friendly message when the caller has one", async () => {
    const res = handleRouteError("x", new Error("boom"), "r", "Try again.");
    expect(await res.json()).toEqual({ error: "Try again.", requestId: "r" });
  });

  it("logs the failure mode and the cause, with the email redacted", () => {
    handleRouteError("waitlist", drizzleError(), "req-123");
    expect(logged).toHaveLength(1);
    const line = logged[0];
    expect(line).toContain("[waitlist] (requestId=req-123)");
    expect(line).toContain("Failed query");
    expect(line).toContain('relation "waitlist" does not exist');
    expect(line).not.toContain(EMAIL);
  });

  it("copes with a thrown non-Error", async () => {
    const res = handleRouteError("x", { weird: true }, "r");
    expect((await res.json()).error).toBe(GENERIC_ERROR_MESSAGE);
    expect(describeErrorForLog("plain string")).toBe("plain string");
  });
});

describe("coachErrorMessage", () => {
  it.each([
    Object.assign(new Error("429 Too Many Requests"), { status: 429 }),
    Object.assign(new Error("upstream"), { statusCode: 503 }),
    Object.assign(new Error("Overloaded"), { status: 529 }),
    new Error("Rate limit reached for model in organization org-abc"),
    new Error("[GoogleGenerativeAI Error]: RESOURCE_EXHAUSTED quota"),
  ])("maps a provider rate limit or overload to the busy copy (%#)", (err) => {
    expect(coachErrorMessage(err)).toBe(COACH_BUSY_MESSAGE);
  });

  it("maps anything else to the generic copy, never the provider text", () => {
    const providerText = `400 {"type":"error","error":{"message":"prompt: my knee hurts, contact ${EMAIL}"}}`;
    const message = coachErrorMessage(new Error(providerText));
    expect(message).toBe(COACH_FAILED_MESSAGE);
    expect(message).not.toContain(EMAIL);
    expect(coachErrorMessage(undefined)).toBe(COACH_FAILED_MESSAGE);
    expect(coachErrorMessage("string")).toBe(COACH_FAILED_MESSAGE);
  });
});
