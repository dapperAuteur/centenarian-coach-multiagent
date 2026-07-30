// tests/sentry-scrub.test.ts
// Guards the privacy contract of src/lib/sentry-scrub.ts.
//
// The primary assertions run against JSON.stringify(scrubbedEvent), not against
// individual fields. That is deliberate: a field-by-field test passes while a
// secret sits in a corner of the payload nobody thought to check, and the thing
// we actually care about is "does the bytes-on-the-wire blob contain this
// string". Every leak test therefore searches the whole serialized event.
//
// Each leak test is paired with a counter-assertion, because an over-redacting
// scrubber is its own failure mode: it silently turns the error inbox into a wall
// of [redacted] and the next production bug takes a day to diagnose. `state` is
// not a secret, `maxTokens` is a number worth seeing, and `content-type` is a
// MIME type -- all three must survive.
//
// FIXTURES ARE ASSEMBLED AT RUNTIME. A committed test file containing a
// contiguous `sk-ant-...`-shaped literal trips GitHub push protection and vendor
// secret scanners, which has bounced this exact change in sibling repos. Every
// fake credential below is built by joining fragments so no scannable literal
// ever exists in the source.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import {
  maskUrl,
  redactText,
  scrubBreadcrumb,
  scrubEvent,
} from "@/lib/sentry-scrub";

const j = (...parts: string[]): string => parts.join("");

/** Fake credentials, shaped like the real thing, assembled at runtime. */
const FAKE = {
  anthropic: j("sk", "-", "ant", "-", "api03", "-", "Aa1".repeat(12)),
  openaiProject: j("sk", "-", "proj", "-", "Bb2".repeat(12)),
  openaiClassic: j("sk", "-", "Cc3".repeat(12)),
  google: j("AI", "za", "Sy", "Dd4".repeat(12)),
  langsmith: j("lsv2", "_", "pt", "_", "Ee5".repeat(12)),
  cerebras: j("csk", "-", "Ff6".repeat(12)),
  mailgun: j("key", "-", "ab12cd34".repeat(4)),
  bearer: j("Ff7".repeat(12)),
  jwt: j("eyJ", "hbGciOiJIUzI1NiJ9", ".", "eyJ", "zdWIiOiJhZG1pbiJ9", ".", "Sig9natur3xyz"),
  neonDsn: j(
    "postgresql://neondb_owner:",
    "npg_",
    "Gg8".repeat(8),
    "@ep-quiet-forest-123.us-east-2.aws.neon.tech/neondb",
  ),
  smtp: j(
    "smtps://postmaster%40mg.witus.online:",
    "Hh9".repeat(8),
    "@smtp.mailgun.org:465",
  ),
  authToken: j("a1b2c3d4", "e5f6a7b8", "c9d0e1f2", "a3b4c5d6"), // 32 hex-ish chars
  sessionUuid: "3f9a1c2e-4b5d-6e7f-8a9b-0c1d2e3f4a5b",
};

/**
 * A realistic health disclosure. This is the string the whole file exists to
 * keep out of a third-party error inbox: ordinary prose, no pattern to match,
 * which is exactly why the strategy is DROP rather than filter.
 */
const DISCLOSURE =
  "resting HR is 48, my left knee gives out on stairs, and I take metformin 500mg twice daily";

/** A model response about that disclosure -- equally sensitive. */
const MODEL_ANSWER =
  "Given your knee instability and metformin use, start with terminal knee extensions";

/** Fresh event per test: scrubEvent mutates in place. */
function buildEvent(): ErrorEvent {
  return {
    // `ErrorEvent` narrows the discriminant to undefined; spelled out so the
    // fixture is a real ErrorEvent and not an `as unknown` escape hatch.
    type: undefined,
    message: `Coach run failed for ${DISCLOSURE}`,
    exception: {
      values: [
        {
          type: "TypeError",
          value: `Anthropic 401: invalid ${j("api", "_", "key")}=${FAKE.anthropic}`,
          stacktrace: {
            frames: [
              {
                filename: "src/agents/supervisor/route.ts",
                function: "routeQuery",
                lineno: 42,
                vars: { userQuery: DISCLOSURE, apiKey: FAKE.google },
              },
            ],
          },
        },
      ],
    },
    user: {
      id: "usr_abc123",
      email: "patient@example.com",
      ip_address: "203.0.113.7",
      username: "patient",
    },
    request: {
      url: "https://coach.witus.online/api/coach/query?userQuery=knee%20pain",
      // SEPARATE FIELD from url -- masking the url does nothing to this.
      query_string: `userQuery=${encodeURIComponent(DISCLOSURE)}&token=${FAKE.authToken}`,
      method: "POST",
      data: { userQuery: DISCLOSURE },
      cookies: { "authjs.session-token": FAKE.jwt },
      env: { REMOTE_ADDR: "203.0.113.7", SERVER_NAME: "vercel-iad1" },
      headers: {
        "content-type": "application/json",
        "content-length": "184",
        "user-agent": "Mozilla/5.0",
        host: "coach.witus.online",
        cookie: `authjs.session-token=${FAKE.jwt}`,
        authorization: `Bearer ${FAKE.bearer}`,
        "x-api-key": FAKE.openaiClassic,
        referer: `https://coach.witus.online/api/auth/callback/email/${FAKE.authToken}`,
      },
    },
    breadcrumbs: [
      { category: "console", level: "error", message: `[app/error] ${MODEL_ANSWER}` },
      {
        category: "fetch",
        type: "http",
        data: {
          url: `https://coach.witus.online/api/coach/sessions/${FAKE.sessionUuid}?debug=1`,
          method: "GET",
          status_code: 500,
        },
      },
      { category: "navigation", message: "/coach -> /coach/history" },
    ],
    extra: {
      userQuery: DISCLOSURE,
      subQuestions: { workout: "knee-safe lower body work" },
      finalAnswer: { text: MODEL_ANSWER },
      citations: [
        { source: "NASM CES Ch 12 - Corrective Strategies for the Knee", snippet: DISCLOSURE, agent: "corrective" },
      ],
      toolCalls: [{ name: "search_kb", input: DISCLOSURE, output: MODEL_ANSWER }],
      sessionId: FAKE.sessionUuid,
      maxTokens: 1024,
      state: "collapsed",
      provider: "anthropic",
      dbUrl: FAKE.neonDsn,
      mailer: FAKE.smtp,
      debugLine: `${j("x", "_", "api", "_", "key")}=${FAKE.cerebras}`,
      langsmithNote: `tracing with ${FAKE.langsmith}`,
      rejectedPayload: `400 {"type":"error","message":"${DISCLOSURE}","model":"claude-sonnet-4-6"}`,
      contactedBy: "bam@awews.com",
    },
    tags: {
      runtime: "nodejs",
      "error.source": "onRequestError",
      route: "/api/coach/query",
    },
    contexts: {
      trace: { trace_id: "9f1b2c3d4e5f60718293a4b5c6d7e8f9", span_id: "1122334455667788", op: "http.server" },
      response: { status_code: 500, body: MODEL_ANSWER },
    },
  } as ErrorEvent;
}

describe("scrubEvent: nothing sensitive survives serialization", () => {
  const serialized = JSON.stringify(scrubEvent(buildEvent()));

  it("drops the health disclosure everywhere it appears", () => {
    // The single most important assertion in this file.
    expect(serialized).not.toContain(DISCLOSURE);
    expect(serialized).not.toContain("metformin");
    expect(serialized).not.toContain("knee gives out");
  });

  it("deletes event.message rather than trying to filter prose out of it", () => {
    // The fixture interpolates the disclosure into event.message, which is exactly
    // the case no regex can classify. The field is removed, not scrubbed.
    expect(JSON.parse(serialized).message).toBeUndefined();
  });

  it("drops the model response, which is a health disclosure by proxy", () => {
    expect(serialized).not.toContain(MODEL_ANSWER);
    expect(serialized).not.toContain("terminal knee extensions");
  });

  it("redacts every LLM provider key by shape, labelled or not", () => {
    expect(serialized).not.toContain(FAKE.anthropic);
    expect(serialized).not.toContain(FAKE.openaiClassic);
    expect(serialized).not.toContain(FAKE.google);
    expect(serialized).not.toContain(FAKE.langsmith);
    expect(serialized).not.toContain(FAKE.cerebras);
    expect(serialized).not.toContain(FAKE.bearer);
    expect(serialized).not.toContain(FAKE.jwt);
  });

  it("redacts credentials embedded in connection strings", () => {
    expect(serialized).not.toContain("npg_");
    expect(serialized).not.toContain("postmaster%40mg.witus.online:");
    // The host survives: it is triage detail, not a secret.
    expect(serialized).toContain("aws.neon.tech");
  });

  it("removes the account identity entirely, id included", () => {
    expect(serialized).not.toContain("usr_abc123");
    expect(serialized).not.toContain("patient@example.com");
    expect(serialized).not.toContain("203.0.113.7");
    expect(JSON.parse(serialized).user).toBeUndefined();
  });

  it("removes the session id, which joins to the health tables", () => {
    expect(serialized).not.toContain(FAKE.sessionUuid);
  });

  it("removes query_string, the field masking the url does not touch", () => {
    expect(JSON.parse(serialized).request.query_string).toBeUndefined();
    expect(serialized).not.toContain(FAKE.authToken);
  });

  it("removes the request body, cookies, and env", () => {
    const request = JSON.parse(serialized).request;
    expect(request.data).toBeUndefined();
    expect(request.cookies).toBeUndefined();
    expect(request.env).toBeUndefined();
  });

  it("drops credential headers by name segment", () => {
    const headers = JSON.parse(serialized).request.headers;
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(headers["x-api-key"]).toBeUndefined();
  });

  it("drops stack-frame local variables wholesale", () => {
    const frame = JSON.parse(serialized).exception.values[0].stacktrace.frames[0];
    expect(frame.vars).toBeUndefined();
  });

  it("drops console breadcrumbs and masks fetch breadcrumb urls", () => {
    const crumbs = JSON.parse(serialized).breadcrumbs as Breadcrumb[];
    expect(crumbs.some((c) => c.category === "console")).toBe(false);
    const fetchCrumb = crumbs.find((c) => c.category === "fetch");
    expect(fetchCrumb?.data?.url).toBe(
      "https://coach.witus.online/api/coach/sessions/<id>?<redacted>",
    );
  });

  it("finds prompts hiding inside a serialized provider error", () => {
    const extra = JSON.parse(serialized).extra;
    expect(extra.rejectedPayload).toContain("[dropped: may contain health data]");
    // The model id is not sensitive and is useful, so the key-aware pass leaves it.
    expect(extra.rejectedPayload).toContain("claude-sonnet-4-6");
  });

  it("redacts an email in free text", () => {
    expect(serialized).not.toContain("bam@awews.com");
    expect(serialized).toContain("[redacted email]");
  });
});

describe("scrubEvent: counter-assertions against over-redaction", () => {
  const event = JSON.parse(JSON.stringify(scrubEvent(buildEvent())));

  it("keeps the exception type and the route, which is the whole point", () => {
    expect(event.exception.values[0].type).toBe("TypeError");
    expect(event.request.url).toBe(
      "https://coach.witus.online/api/coach/query?<redacted>",
    );
    expect(event.request.method).toBe("POST");
  });

  it("keeps the stack frame", () => {
    const frame = event.exception.values[0].stacktrace.frames[0];
    expect(frame.filename).toBe("src/agents/supervisor/route.ts");
    expect(frame.function).toBe("routeQuery");
    expect(frame.lineno).toBe(42);
  });

  it("keeps `state`, which is NOT a secret", () => {
    expect(event.extra.state).toBe("collapsed");
  });

  it("keeps `maxTokens`, because segments beat substrings", () => {
    // A substring match on "token" would have destroyed this.
    expect(event.extra.maxTokens).toBe(1024);
  });

  it("keeps non-credential headers, content-type included", () => {
    // "content" is a content-key segment, so a naive pass would drop these.
    expect(event.request.headers["content-type"]).toBe("application/json");
    expect(event.request.headers["content-length"]).toBe("184");
    expect(event.request.headers["user-agent"]).toBe("Mozilla/5.0");
    expect(event.request.headers.host).toBe("coach.witus.online");
  });

  it("keeps the referer, masked, rather than deleting it", () => {
    // Sticky path context: /callback puts the rest of the path in token territory,
    // so the credential two segments later is still caught while `email` survives.
    expect(event.request.headers.referer).toBe(
      "https://coach.witus.online/api/auth/callback/email/<token>",
    );
  });

  it("keeps a short real error string intact, uncapped", () => {
    // The cap must not fire on the error strings this stack actually throws.
    const short = scrubEvent({
      type: undefined,
      exception: {
        values: [{ type: "Error", value: 'invalid input syntax for type uuid: "abc"' }],
      },
    } as ErrorEvent);
    expect(short.exception?.values?.[0].value).toBe(
      'invalid input syntax for type uuid: "abc"',
    );
  });

  it("caps an exception value that echoes a whole prompt back", () => {
    const echoed = scrubEvent({
      type: undefined,
      exception: {
        values: [
          {
            type: "APIError",
            value: `400 bad request from provider: ${DISCLOSURE.repeat(8)}`,
          },
        ],
      },
    } as ErrorEvent);
    const value = echoed.exception?.values?.[0].value ?? "";
    expect(value).toContain("[truncated]");
    expect(value.length).toBeLessThan(260);
    expect(value).toContain("400 bad request from provider");
  });

  it("keeps bibliographic citation sources while dropping their snippets", () => {
    expect(event.extra.citations[0].source).toContain("NASM CES Ch 12");
    expect(event.extra.citations[0].agent).toBe("corrective");
    expect(event.extra.citations[0].snippet).toBe(
      "[dropped: may contain health data]",
    );
  });

  it("keeps tool-call names while dropping their input and output", () => {
    expect(event.extra.toolCalls[0].name).toBe("search_kb");
    expect(event.extra.toolCalls[0].input).toBe(
      "[dropped: may contain health data]",
    );
  });

  it("keeps tags and the operational provider name", () => {
    expect(event.tags.runtime).toBe("nodejs");
    expect(event.tags.route).toBe("/api/coach/query");
    expect(event.extra.provider).toBe("anthropic");
  });

  it("exempts contexts.trace so events still link to their trace", () => {
    expect(event.contexts.trace.trace_id).toBe(
      "9f1b2c3d4e5f60718293a4b5c6d7e8f9",
    );
    expect(event.contexts.trace.span_id).toBe("1122334455667788");
    expect(event.contexts.trace.op).toBe("http.server");
  });

  it("still scrubs non-trace contexts", () => {
    expect(event.contexts.response.status_code).toBe(500);
    expect(event.contexts.response.body).toBe(
      "[dropped: may contain health data]",
    );
  });

  it("keeps navigation breadcrumbs", () => {
    const nav = (event.breadcrumbs as Breadcrumb[]).find(
      (c) => c.category === "navigation",
    );
    expect(nav?.message).toBe("/coach -> /coach/history");
  });

  it("is idempotent: a second pass does not re-redact markers", () => {
    const once = scrubEvent(buildEvent());
    const twice = JSON.stringify(scrubEvent(JSON.parse(JSON.stringify(once))));
    expect(twice).not.toContain("[[redacted]");
    expect(twice).not.toContain("redacted]: [redacted]");
    expect(twice).toContain("TypeError");
  });
});

describe("redactText", () => {
  it("defeats the underscore boundary that `\\b` cannot", () => {
    // /\bapi_key/ never matches here, because `_` is a word character.
    const input = `${j("x", "_", "api", "_", "key")}=${FAKE.mailgun}`;
    const out = redactText(input);
    expect(out).not.toContain(FAKE.mailgun);
    expect(out).toContain("[redacted]");
  });

  it("redacts a labelled secret with any separator", () => {
    expect(redactText(`${j("api", "-", "key")}: hunter2xyz`)).toContain("[redacted]");
    expect(redactText("password = swordfish9")).toContain("[redacted]");
    expect(redactText("client_secret is topsecret1")).toContain("[redacted]");
  });

  it("redacts the token after an auth scheme, not the scheme word", () => {
    const out = redactText(`Authorization: Bearer ${FAKE.bearer}`);
    expect(out).not.toContain(FAKE.bearer);
    expect(out).toContain("Bearer");
  });

  it("leaves ordinary prose containing secret-ish words alone", () => {
    const prose =
      "The supervisor state machine keys off the routing decision, not the token count.";
    expect(redactText(prose)).toBe(prose);
  });

  it("leaves an unlabelled short id alone", () => {
    expect(redactText("run 42 finished in 1200ms")).toBe(
      "run 42 finished in 1200ms",
    );
  });
});

describe("maskUrl: path context beats shape", () => {
  it("masks a row id as an id", () => {
    expect(maskUrl(`https://x.test/coach/history/${FAKE.sessionUuid}`)).toBe(
      "https://x.test/coach/history/<id>",
    );
  });

  it("masks a credential in a token-bearing route as a token", () => {
    expect(maskUrl(`https://x.test/api/auth/verify-request/${FAKE.authToken}`)).toBe(
      "https://x.test/api/auth/verify-request/<token>",
    );
  });

  it("keeps a short provider name in a token-bearing route", () => {
    // 5 characters cannot be a credential; masking it would cost the provider name.
    expect(maskUrl("https://x.test/api/auth/callback/witus")).toBe(
      "https://x.test/api/auth/callback/witus",
    );
  });

  it("keeps a readable slug that happens to be long", () => {
    expect(maskUrl("https://x.test/guide/lessons/01-single-vs-multi-agent")).toBe(
      "https://x.test/guide/lessons/01-single-vs-multi-agent",
    );
  });

  it("drops the query string and fragment wholesale", () => {
    expect(maskUrl("https://x.test/coach?userQuery=knee%20pain#top")).toBe(
      "https://x.test/coach?<redacted>",
    );
  });

  it("keeps a root-relative route path, which is the best triage detail", () => {
    expect(maskUrl("/api/coach/query")).toBe("/api/coach/query");
    expect(maskUrl("/api/coach/query?token=abc")).toBe("/api/coach/query?<redacted>");
  });

  it("drops anything it cannot parse as a url", () => {
    expect(maskUrl("not a url at all")).toBe("[redacted url]");
  });
});

describe("scrubBreadcrumb", () => {
  it("drops the console channel entirely", () => {
    expect(
      scrubBreadcrumb({ category: "console", message: `[app/error] ${DISCLOSURE}` }),
    ).toBeNull();
  });

  it("keeps a ui.click breadcrumb with its selector", () => {
    const crumb = scrubBreadcrumb({ category: "ui.click", message: "button.submit" });
    expect(crumb?.message).toBe("button.submit");
  });
});

describe("module safety invariants", () => {
  const source = readFileSync(
    new URL("../src/lib/sentry-scrub.ts", import.meta.url),
    "utf8",
  );

  it("contains no regex lookbehind", () => {
    // `(?<=` / `(?<!` is a SyntaxError on iOS Safari < 16.4. This module is
    // imported by instrumentation-client.ts, so one lookbehind breaks the whole
    // client chunk for those users even when no DSN is configured.
    const code = source
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
      .join("\n");
    expect(code).not.toContain("(?<=");
    expect(code).not.toContain("(?<!");
  });

  it("handles a cyclic payload without hanging", () => {
    const event = buildEvent() as ErrorEvent & { extra: Record<string, unknown> };
    const cycle: Record<string, unknown> = { label: "loop" };
    cycle.self = cycle;
    event.extra.cycle = cycle;
    expect(() => scrubEvent(event)).not.toThrow();
  });

  it("never returns null: the crash signal is the point", () => {
    expect(scrubEvent(buildEvent())).not.toBeNull();
    expect(scrubEvent({ type: undefined } as ErrorEvent)).not.toBeNull();
  });
});
