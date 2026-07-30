// src/lib/sentry-scrub.ts
// Sentry `beforeSend` / `beforeBreadcrumb` scrubber for the Centenarian Coach.
//
// WHY THIS IS THE STRICTEST SCRUBBER IN THE ECOSYSTEM
// ---------------------------------------------------
// This app is an LLM health coach. Someone types "resting HR is 48, my left knee
// gives out on stairs, I take metformin", four specialist agents each retrieve
// against that text, and a synthesizer writes an answer about it. So the two most
// sensitive strings in the system are the PROMPT and the MODEL RESPONSE, and both
// are in memory at exactly the moment something can throw. A crash report is a
// snapshot of that memory shipped to a third party.
//
// Two consequences drive every decision below.
//
//   1. Prompt and response content is DROPPED, not filtered. There is no regex
//      for "this sentence is a health disclosure" -- it is ordinary prose, so
//      filtering free text can only ever be a guess. Any field carrying model
//      input, model output, or retrieved source text is removed wholesale and
//      replaced with a marker (see CONTENT_KEY_SEGMENTS). Losing the text costs a
//      few minutes of triage; keeping it publishes somebody's medical history to
//      an error inbox.
//   2. The ENTIRE `event.user` object goes, not just email/ip/username. The user
//      id and the coach session id both join straight to `coach_sessions.query`
//      and `coach_specialist_calls.finding_text` (src/db/schema.ts), so in this
//      app an "opaque identifier" is a patient identifier. This follows the
//      precedent set by the gemini/centenarian-os scrubber.
//
// Those two rules handle every STRUCTURED field. The residual problem is FREE
// PROSE, where "drop, do not filter" cannot be applied wholesale without throwing
// away the crash signal itself. Three answers, in order of how much they give up:
//   * `event.message` is DELETED outright -- it duplicates the exception value on
//     exception events and is only otherwise set by captureMessage(), which this
//     app never calls, so there is nothing to lose.
//   * `exception.value` is scrubbed, key-aware-scrubbed for embedded JSON, and
//     then capped (MAX_EXCEPTION_VALUE_LEN) so an SDK echoing a rejected prompt
//     cannot ship the whole conversation.
//   * Everything else that is prose by nature -- a finding, an answer, a snippet,
//     a comment -- is identified by its KEY and dropped, never inspected.
//
// The bias is REDACT WHEN UNSURE. The scrubber never returns null: we still want
// to know that the app crashed, just not who it crashed for or what they asked.
//
// Pure and self-contained on purpose. It runs in the error path on all three
// runtimes (node, edge, browser), so it must not import the db client, the LLM
// config, or anything else that could itself be the broken thing.
//
// IMPLEMENTATION CONSTRAINTS (each one is a bug a sibling repo already shipped)
// ----------------------------------------------------------------------------
//   * NO REGEX LOOKBEHIND. `(?<=...)` is a SyntaxError on iOS Safari < 16.4, and
//     because instrumentation-client.ts imports this module it is parsed on every
//     page load -- one lookbehind here breaks the entire client chunk for those
//     users EVEN WITH NO DSN SET. Lookahead `(?!...)` is safe and is used below.
//   * `\b` DOES NOT WORK FOR SECRET LABELS. `_` is a word character, so
//     /\bapi_key/ never matches inside `x_api_key`. Every label boundary here is
//     an explicit `(^|[^A-Za-z0-9])` capture that is re-emitted, which makes `_`
//     and `-` count as boundaries.
//   * `event.request.query_string` IS A SEPARATE FIELD from `event.request.url`.
//     Masking the url does nothing to it. It is deleted explicitly.
//   * THE DEEP SCRUB IS KEY-AWARE AND MATCHES PER NAME SEGMENT. Keys split on
//     `-`/`_`/`.` and camelCase humps, then compare segment by segment. Substring
//     matching is wrong in both directions: it would redact `maxTokens` (a number
//     worth seeing) and `keyboard`, while `state` is NOT a secret and must
//     survive. Segment matching gets all three right.
//   * PATH CONTEXT BEATS SHAPE. A 32-char hex blob is a row id under
//     /coach/history/<id> and a live magic-link credential under
//     /api/auth/callback/<token>. maskUrl therefore reads the PRECEDING path
//     segment: inside a known token-bearing route, any segment of 12+ characters
//     is masked, so a short or oddly shaped token is still caught.

import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const REDACTED = "[redacted]";
const REDACTED_EMAIL = "[redacted email]";
const REDACTED_URL = "[redacted url]";
/** Marker for prompt / response / retrieval text: dropped, never filtered. */
const DROPPED_CONTENT = "[dropped: may contain health data]";
const DROPPED_DEPTH = "[dropped: nested too deep to scrub]";

// ---------------------------------------------------------------------------
// Text-level patterns
// ---------------------------------------------------------------------------

/** Absolute http(s) URLs. Trailing punctuation is excluded so we rewrite the URL
 *  and not the prose wrapped around it. */
const URL_RE = /https?:\/\/[^\s<>"')\]}]+/g;

/** Email addresses in free text. ADMIN_EMAIL is the account, and the waitlist
 *  table is nothing but emails. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * LLM/vendor credentials matched BY SHAPE, so an unlabelled key pasted into a log
 * line or echoed back by a provider SDK error is still caught. Every prefix here
 * belongs to a provider this repo actually calls (see .env.example), plus JWTs
 * for the Auth.js session and the WitUS OIDC handoff.
 *
 * Deliberately NO `\b` anchors: each prefix is distinctive enough that an anchor
 * buys nothing, and omitting them sidesteps the underscore problem entirely.
 * Alternation order matters -- the specific `sk-ant-` / `sk-or-v1-` forms are
 * tried before the generic `sk-` run, whose alphanumeric-only tail would
 * otherwise stop dead at the first hyphen.
 */
const PROVIDER_KEY_RE = new RegExp(
  [
    "sk-ant-[A-Za-z0-9_-]{8,}", // Anthropic
    "sk-or-v1-[A-Za-z0-9_-]{8,}", // OpenRouter
    "sk-proj-[A-Za-z0-9_-]{8,}", // OpenAI, project-scoped
    "sk-[A-Za-z0-9]{20,}", // OpenAI classic and lookalikes
    "csk-[A-Za-z0-9_-]{8,}", // Cerebras
    "AIza[A-Za-z0-9_-]{20,}", // Google AI Studio / Gemini
    "lsv2_[A-Za-z0-9_-]{8,}", // LangSmith, both pt_ and sk_ variants
    "key-[0-9a-f]{24,}", // Mailgun
    "eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]+", // JWT
  ].join("|"),
  "g",
);

/**
 * Credentials embedded in a NON-http connection string: the Neon
 * `postgresql://user:pass@host` DSN and the Mailgun SMTP `EMAIL_SERVER`. URL_RE
 * runs first and covers http(s) (maskUrl drops userinfo along with the origin
 * rebuild), so this pass exists for the schemes URL_RE deliberately ignores. The
 * scheme and host survive because they are useful triage detail, not secrets.
 */
const CONNECTION_STRING_RE = /([A-Za-z][A-Za-z0-9+.-]*):\/\/[^\s/@]+:[^\s/@]+@/g;

/** Label words meaning "whatever follows me is a secret". Internal separators are
 *  optional so `api_key`, `api-key`, and `apikey` all match. */
const SECRET_LABEL_WORDS = [
  "api[_-]?key",
  "apikey",
  "secret[_-]?key",
  "access[_-]?token",
  "refresh[_-]?token",
  "id[_-]?token",
  "session[_-]?token",
  "client[_-]?secret",
  "ingest[_-]?secret",
  "auth[_-]?secret",
  "nextauth[_-]?secret",
  "authorization",
  "bearer",
  "password",
  "passwd",
  "passcode",
  "credential",
  "secret",
  "token",
  "pin",
  "verification[_-]?code",
  "one[-\\s]?time[-\\s]?code",
  "magic[-\\s]?link",
].join("|");

/**
 * `Bearer <token>` / `Basic <blob>`: an auth scheme followed by whitespace, with
 * none of the `:`/`=` separators SECRET_LABEL_RE requires. Runs BEFORE
 * SECRET_LABEL_RE so that in `Authorization: Bearer abc.def` the token is gone
 * before the label pass gets there.
 */
const AUTH_SCHEME_RE =
  /(^|[^A-Za-z0-9])(Bearer|Basic|Token)\s+([A-Za-z0-9._~+/=-]{8,})/gi;

/**
 * A labelled raw secret in prose: `api_key: hunter2`, `x_api_key = ...`,
 * `password is swordfish`. The leading boundary is a captured
 * `(^|[^A-Za-z0-9])` rather than `\b`, so `_` and `-` are boundaries -- that is
 * the whole `x_api_key` fix. A separator is required (`is`, `:`, `=`), so an
 * ordinary sentence containing the word "token" is left alone.
 *
 * Three lookaheads guard the value: `(?!\[)` stops a second pass re-redacting
 * `[redacted]`, and the scheme lookaheads stop `Authorization: Bearer xyz` from
 * matching with "Bearer" as the value (AUTH_SCHEME_RE already handled it).
 * Lookahead only -- never lookbehind.
 */
const SECRET_LABEL_RE = new RegExp(
  `(^|[^A-Za-z0-9])(${SECRET_LABEL_WORDS})\\s*(?:is|:|=)\\s*` +
    `(?!\\[)(?!Bearer\\s)(?!Basic\\s)(?!Token\\s)([^\\s,;'"]{3,})`,
  "gi",
);

/**
 * A `"key": "value"` pair inside serialized JSON that ended up in an error
 * message. Provider SDKs echo the request they rejected ("400 {...}"), so an
 * entire prompt can arrive INSIDE an exception value, where no structural scrub
 * can reach it. This pass is key-aware in flat text: content keys get the
 * dropped marker, secret keys get `[redacted]`, everything else is untouched.
 * Escaped quotes are handled so a value is never truncated mid-string.
 */
const JSON_PAIR_RE = /"([A-Za-z0-9_.$-]{1,64})"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

// ---------------------------------------------------------------------------
// Key classification -- per NAME SEGMENT, never substring
// ---------------------------------------------------------------------------

/**
 * Split an object key or header name into lowercase name segments.
 * `userQuery` -> ["user","query"] - `x-api-key` -> ["x","api","key"] -
 * `sub_question` -> ["sub","question"] - `state` -> ["state"].
 */
function keySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

/**
 * Segments meaning the VALUE is a credential, or an identifier that joins to
 * health data. `session` is here on purpose: a coach session id is the primary
 * key of the table holding the user's question. Note `tokens` is deliberately
 * ABSENT while `token` is present, because `maxTokens` is a generation setting
 * worth seeing in a crash report -- exactly the distinction a substring match
 * cannot make.
 */
const SECRET_KEY_SEGMENTS = new Set([
  "auth",
  "authorization",
  "bearer",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "dsn",
  "jwt",
  "key",
  "otp",
  "passcode",
  "passwd",
  "password",
  "pin",
  "secret",
  "session",
  "signature",
  "token",
]);

/**
 * Segments meaning the VALUE is model input, model output, or retrieved source
 * text. Every one maps to a real field in this codebase: `userQuery` and
 * `subQuestions` (src/state.ts), `finding.text`, `citation.snippet`,
 * `toolCall.input`/`output`, `finalAnswer.text`, `coach_feedback.comment`, and
 * the NDJSON events streamed by /api/coach/query. These are DROPPED, not
 * filtered -- see the file header.
 *
 * `citations` is intentionally NOT here: it is an array of
 * `{ source, snippet, agent }`, so the deep scrub recurses in and drops the
 * `snippet` while keeping the bibliographic `source`. Dropping the array whole
 * would lose which specialist cited what for no privacy gain.
 */
const CONTENT_KEY_SEGMENTS = new Set([
  "answer",
  "arguments", // a console breadcrumb's args are whatever the app logged
  "body",
  "chunk",
  "comment",
  "completion",
  "content",
  "conversation",
  "diagnosis",
  "excerpt",
  "finding",
  "findings",
  "history",
  "input",
  "inputs",
  "medication",
  "medications",
  "message",
  "messages",
  "note",
  "notes",
  "output",
  "outputs",
  "prompt",
  "prompts",
  "query",
  "question",
  "questions",
  "rationale",
  "response",
  "snippet",
  "snippets",
  "symptom",
  "symptoms",
  "text",
  "transcript",
  "vitals",
]);

type KeyKind = "secret" | "content" | "keep";

function classifyKey(key: string): KeyKind {
  const segments = keySegments(key);
  for (const segment of segments) {
    if (SECRET_KEY_SEGMENTS.has(segment)) return "secret";
  }
  for (const segment of segments) {
    if (CONTENT_KEY_SEGMENTS.has(segment)) return "content";
  }
  return "keep";
}

/**
 * Header-name test. Headers get the SECRET check only, never the content check:
 * `content-type` and `content-length` split to segments including "content", and
 * dropping those would cost real triage value for zero privacy gain (a MIME type
 * is not a health disclosure).
 */
function isSecretKey(key: string): boolean {
  return classifyKey(key) === "secret";
}

// ---------------------------------------------------------------------------
// URL masking
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Path segments that put the REST of the path into "credentials live here"
 * territory. Auth.js parks the magic-link token and the CSRF token under
 * /api/auth/*, and not always in the segment immediately after the keyword:
 * /api/auth/callback/email/<token> puts the provider name in between. So the flag
 * is sticky for the remainder of the path rather than looking one segment back.
 *
 * The cost is that a long readable slug inside an auth route also gets masked.
 * That is the right trade: auth routes are exactly where a credential can be, so
 * over-masking there is cheap and under-masking there is not.
 */
const TOKEN_PATH_SEGMENTS = new Set([
  "callback",
  "confirm",
  "csrf",
  "invite",
  "magic",
  "reset",
  "session",
  "signin",
  "token",
  "verify",
  "verify-request",
]);

/**
 * Is this path segment an opaque identifier rather than a readable slug? A UUID,
 * a long hex run, or a 16+ char mixed alphanumeric blob with no separators.
 * Requiring "no separators, and at least one digit and one letter" is what keeps
 * /guide/lessons/01-single-vs-multi-agent readable while still masking
 * /coach/history/<uuid>.
 */
function isOpaqueId(segment: string): boolean {
  if (UUID_RE.test(segment)) return true;
  if (/^[0-9a-f]{24,}$/i.test(segment)) return true;
  return (
    /^[A-Za-z0-9]{16,}$/.test(segment) &&
    /[0-9]/.test(segment) &&
    /[A-Za-z]/.test(segment)
  );
}

/**
 * Rewrite a URL down to something safe to send: scheme + host + path, ids and
 * tokens masked, query string and fragment dropped WHOLESALE.
 *
 * Dropping the whole query is the strict choice on purpose. A magic-link `token`,
 * an OAuth `code`, and a bare `?email=` all live there, and an allowlist of
 * "safe" params is a list somebody eventually forgets to update. Losing `?page=2`
 * off a crash report is a fine price for that.
 *
 * Relative URLs are parsed rather than discarded: `event.request.url` is often
 * just `/api/coach/query`, and that route is the single most useful fact in the
 * report. A string that parses neither way is dropped, because we cannot reason
 * about what is inside it.
 */
export function maskUrl(raw: string): string {
  let url: URL;
  let relative = false;
  try {
    url = new URL(raw);
  } catch {
    // Only a root-relative path gets the second chance. Resolving arbitrary text
    // against a base would "succeed" for any string at all and hand back a
    // percent-encoded version of it, which is the opposite of redacting.
    if (!raw.startsWith("/")) return REDACTED_URL;
    try {
      url = new URL(raw, "http://relative.invalid");
      relative = true;
    } catch {
      return REDACTED_URL;
    }
  }
  let inTokenContext = false;
  const masked = url.pathname.split("/").map((segment) => {
    if (!segment) return segment;
    // Path context beats shape: once inside a token-bearing route, mask anything
    // long enough to be a credential no matter what shape it has. The keyword
    // segment itself is kept, so /api/auth/session still reads as a route.
    if (inTokenContext && segment.length >= 12) return "<token>";
    if (TOKEN_PATH_SEGMENTS.has(segment.toLowerCase())) {
      inTokenContext = true;
      return segment;
    }
    return isOpaqueId(segment) ? "<id>" : segment;
  });
  const suffix = url.search || url.hash ? "?<redacted>" : "";
  const path = masked.join("/");
  return relative ? `${path}${suffix}` : `${url.origin}${path}${suffix}`;
}

// ---------------------------------------------------------------------------
// Text scrubbing
// ---------------------------------------------------------------------------

/**
 * Strip identifiers and credentials from a free-text string. Order matters: URLs
 * are masked first so anything hiding in a query string is already gone before
 * the email and key passes run over what is left, and AUTH_SCHEME_RE runs before
 * SECRET_LABEL_RE so `Authorization: Bearer <token>` loses the token and not just
 * the word "Bearer".
 */
export function redactText(input: string): string {
  return input
    .replace(URL_RE, maskUrl)
    .replace(
      CONNECTION_STRING_RE,
      (_match, scheme: string) => `${scheme}://${REDACTED}@`,
    )
    .replace(PROVIDER_KEY_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED_EMAIL)
    .replace(JSON_PAIR_RE, (match, key: string) => {
      const kind = classifyKey(key);
      if (kind === "secret") return `"${key}":"${REDACTED}"`;
      if (kind === "content") return `"${key}":"${DROPPED_CONTENT}"`;
      return match;
    })
    .replace(
      AUTH_SCHEME_RE,
      (_match, pre: string, scheme: string) => `${pre}${scheme} ${REDACTED}`,
    )
    .replace(
      SECRET_LABEL_RE,
      (_match, pre: string, label: string) => `${pre}${label}: ${REDACTED}`,
    );
}

/**
 * Hard cap on an exception's `value`. This is the one field that must survive as
 * free prose -- "invalid input syntax for type uuid" and
 * "authentication_error: invalid x-api-key" are the whole crash signal -- and it
 * is also the one field a third-party SDK can stuff a prompt into. Anthropic's
 * 400s echo the rejected `messages` array, so an unbounded value can be the
 * entire conversation.
 *
 * 200 characters comfortably fits every real error string in this stack while
 * bounding a bulk echo. The key-aware JSON pass in redactText runs first and does
 * the surgical part (dropping content-keyed values inside an embedded payload);
 * this is the blunt backstop for echoes that are not JSON.
 *
 * RESIDUAL RISK, stated plainly: if app code ever interpolates user prose into an
 * Error message shorter than this cap, it ships. No regex can catch that, so the
 * mitigation is a code rule -- never put `userQuery`, a finding, or an answer into
 * an error string; pass the requestId instead (src/lib/api-error.ts already does).
 */
const MAX_EXCEPTION_VALUE_LEN = 200;

function truncate(value: string): string {
  return value.length <= MAX_EXCEPTION_VALUE_LEN
    ? value
    : `${value.slice(0, MAX_EXCEPTION_VALUE_LEN)}... [truncated]`;
}

// ---------------------------------------------------------------------------
// Structural deep scrub
// ---------------------------------------------------------------------------

const MAX_DEPTH = 8;

/**
 * Walk an arbitrary object/array graph and scrub it IN PLACE, deciding per key: a
 * secret key's value becomes `[redacted]`, a content key's value is dropped, and
 * anything else is recursed into (strings run through redactText).
 *
 * Two safety rails. Past MAX_DEPTH the PARENT replaces the value with a marker
 * rather than the child silently returning unscrubbed -- a depth cap that leaves
 * data behind is worse than no cap. And a `seen` set stops a cyclic `extra`
 * payload from hanging the error path; a repeat visit is safe to skip because
 * that object was already scrubbed on its first visit.
 */
function deepScrub(node: unknown, depth: number, seen: WeakSet<object>): void {
  if (node === null || typeof node !== "object") return;
  if (seen.has(node as object)) return;
  seen.add(node as object);

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const item = node[i];
      if (typeof item === "string") {
        node[i] = redactText(item);
      } else if (item !== null && typeof item === "object") {
        if (depth + 1 > MAX_DEPTH) node[i] = DROPPED_DEPTH;
        else deepScrub(item, depth + 1, seen);
      }
    }
    return;
  }

  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const kind = classifyKey(key);
    if (kind === "secret") {
      record[key] = REDACTED;
      continue;
    }
    if (kind === "content") {
      record[key] = DROPPED_CONTENT;
      continue;
    }
    if (typeof value === "string") {
      record[key] = redactText(value);
    } else if (value !== null && typeof value === "object") {
      if (depth + 1 > MAX_DEPTH) record[key] = DROPPED_DEPTH;
      else deepScrub(value, depth + 1, seen);
    }
  }
}

/** Public wrapper so callers need not thread the depth/seen arguments. */
export function scrubDeep(node: unknown): void {
  deepScrub(node, 0, new WeakSet<object>());
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

/**
 * Sentry `beforeBreadcrumb`. Breadcrumbs replay the fetches, navigations, and
 * clicks leading up to a crash, which makes them the most useful part of a report
 * and also the part most likely to carry a URL or a logged payload.
 *
 * `console` breadcrumbs are DROPPED ENTIRELY. src/app/error.tsx already does
 * `console.error("[app/error]", error)`, and any future `console.log` of a
 * streamed answer would be vacuumed into a breadcrumb verbatim. There is no way
 * to know in advance what an app logs, so on a health app the console channel is
 * not worth keeping at all.
 */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category === "console") return null;
  if (crumb.message) crumb.message = redactText(crumb.message);
  if (crumb.data) scrubDeep(crumb.data);
  return crumb;
}

// ---------------------------------------------------------------------------
// beforeSend
// ---------------------------------------------------------------------------

/**
 * Sentry `beforeSend`. Returns the event with identifiers, credentials, and all
 * prompt/response content removed. Never returns null: the crash signal is the
 * entire point of sending the event.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  // `event.message` is DELETED, not scrubbed. It is only ever populated by
  // captureMessage(), which this app never calls, and when Sentry fills it in for
  // an exception event it just duplicates exception.values[0].value. That makes it
  // pure downside here: a hand-assembled string is the single most likely place
  // for code to have interpolated request context into an error, and free prose is
  // exactly what no regex can classify. Deleting it costs nothing and closes the
  // biggest prose hole. See MAX_EXCEPTION_VALUE_LEN for the other one.
  delete event.message;

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = truncate(redactText(exception.value));
    }
    for (const frame of exception.stacktrace?.frames ?? []) {
      // Local variables are captured verbatim when includeLocalVariables is on.
      // Here a local named `userQuery` or `findingText` IS the health disclosure,
      // so the whole map goes rather than being walked.
      if (frame.vars) delete frame.vars;
    }
  }

  // Drop the account identity ENTIRELY, not just the obvious PII fields: the user
  // id joins to coach_sessions, so it is a patient identifier here and not the
  // harmless opaque handle it is in a catalog app. The stack trace and the error
  // digest are what triage actually needs.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
    delete event.user.id;
    delete event.user;
  }

  if (event.request) {
    if (typeof event.request.url === "string") {
      event.request.url = maskUrl(event.request.url);
    }
    // query_string is a SEPARATE field from url. Masking the url does not touch
    // it, and it is where a magic-link token or a `?q=` health question lands.
    delete event.request.query_string;
    // The request body of POST /api/coach/query IS the user's health question.
    delete event.request.data;
    delete event.request.cookies;
    // Sentry's request `env` carries REMOTE_ADDR (the IP) and SERVER_NAME.
    delete event.request.env;

    const headers = event.request.headers as Record<string, string> | undefined;
    if (headers) {
      for (const name of Object.keys(headers)) {
        if (isSecretKey(name)) delete headers[name];
      }
      // Referer survives, masked: which page the user came from is genuinely
      // useful, but it can carry a token in its own query string.
      if (typeof headers.referer === "string") {
        headers.referer = maskUrl(headers.referer);
      }
      if (typeof headers.referrer === "string") {
        headers.referrer = maskUrl(headers.referrer);
      }
    }
  }

  if (event.breadcrumbs) {
    const kept: Breadcrumb[] = [];
    for (const crumb of event.breadcrumbs) {
      const scrubbed = scrubBreadcrumb(crumb);
      if (scrubbed) kept.push(scrubbed);
    }
    event.breadcrumbs = kept;
  }

  scrubDeep(event.extra);
  scrubDeep(event.tags);

  // Contexts hold both useful runtime facts and arbitrary app-supplied blobs.
  // `trace` is EXEMPT: trace_id / span_id / op carry no user data, and scrubbing
  // them would break linking an event to its trace for no privacy gain.
  if (event.contexts) {
    for (const [name, context] of Object.entries(event.contexts)) {
      if (name === "trace") continue;
      scrubDeep(context);
    }
  }

  return event;
}
