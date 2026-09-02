// src/lib/silent-sso.ts
// Pure helpers for the silent ecosystem-SSO check ("Continue as <name>") and for
// global sign-out. No env access, no `next/headers`, no window access at module
// scope — the client button, the server pages, and the tests all import from here.
// Env-derived values live in src/lib/witus-sso.ts (server only).
//
// WHY A CROSS-ORIGIN PROBE AND NOT OIDC `prompt=none`. `prompt=none` is a
// NAVIGATION: you leave the sign-in page to ask the question. BAM chose
// (2026-08-30) to render the form immediately and ask in parallel, so the only
// in-page way to ask is either a hidden iframe (Safari ITP blocks it) or a CORS
// fetch against a dedicated IdP endpoint. This is the latter.
//
// WHAT IT BUYS AND WHAT IT DOES NOT. The probe carries the IdP's cookie as a
// THIRD-PARTY cookie, so it answers on Chrome/Edge and answers nothing under
// Safari ITP or Firefox Total Cookie Protection. That is the design, not a bug: a
// probe that answers nothing renders nothing, and the visitor keeps exactly the
// sign-in page they already had. A failed silent check must be invisible.
//
// THE NAME THIS RETURNS IS DISPLAY COPY, NEVER A CREDENTIAL. It arrives over an
// origin boundary, so it is client-supplied by definition. Nothing here may gate
// access, populate a session, or be sent anywhere. Clicking the button runs the
// real OIDC code flow (NextAuth's "witus" provider, src/auth.ts), which is the
// only thing that establishes identity.

/** Query param marking "this browser already tried the ecosystem flow on this page". */
export const SSO_ATTEMPT_PARAM = "sso";
export const SSO_ATTEMPT_VALUE = "tried";

/**
 * sessionStorage key for the same one-shot marker. Written IMMEDIATELY BEFORE the
 * browser is sent to the IdP, never after it comes back: a marker written on
 * return is a marker that never exists when the return is the thing that failed.
 */
export const SSO_ATTEMPT_STORAGE_KEY = "witus.sso.attempted";

/** How long to wait for the probe before giving up. A silent check that hangs is a broken page. */
export const SILENT_SSO_TIMEOUT_MS = 4000;

/** Longest display name rendered. Caps a hostile or absurd value from blowing up the button. */
const MAX_LABEL_LENGTH = 48;

// Control characters are stripped from the display name before it is rendered.
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

/** Identity shown on the button. Display only, never a credential. */
export interface SsoIdentity {
  /** What "Continue as ___" says — already trimmed, de-controlled, length-capped. */
  label: string;
}

export type SilentSsoSkip =
  | "continue-as-disabled"
  | "not-configured"
  | "already-attempted"
  | "already-signed-in";

export type SilentSsoDecision =
  | { attempt: true }
  | { attempt: false; skip: SilentSsoSkip };

/**
 * Should this browser ask the IdP who it is?
 *
 * `endpoint` is resolved on the SERVER from WITUS_OIDC_DISCOVERY_URL and is null
 * whenever this app is not a configured ecosystem OIDC client — the feature stays
 * completely dark in that case, because an affordance the visitor cannot complete
 * is worse than no affordance.
 *
 * (Unlike learn.witus.online this app is single-tenant and WitUS-branded, so there
 * is no per-tenant white-label gate to check: every host that serves this app is a
 * WitUS host.)
 *
 * WHY AN APP WOULD TURN THIS OFF (`showContinueAs: false`). On an ADMIN-GATED app
 * the personalized label is a promise the app cannot keep. This module CANNOT and
 * MUST NOT tell an admin from a non-admin before the flow runs: the probe answer
 * crosses an origin boundary, so it is client-supplied display copy, and gating
 * access on it would be a security bug. So the honest alternative is not "probe and
 * filter" — it is "do not probe". A visitor who is offered "Continue as Jane",
 * clicks, spends a full OIDC round trip and is then refused has been invited to a
 * door that gets slammed; the plain "Sign in with WitUS" button makes the same
 * refusal without the personal invitation. DO NOT "restore" the personalized label
 * on centenarian-coach-multiagent or witus-inbox as a missing feature — it is
 * deliberately off there (BAM, 2026-09-01), while the mechanism below stays intact
 * and shared for the open apps that should use it.
 */
export function silentSsoDecision(input: {
  endpoint: string | null | undefined;
  search?: string | null;
  attempted?: boolean;
  signedIn?: boolean;
  showContinueAs?: boolean;
}): SilentSsoDecision {
  // APP POLICY, CHECKED FIRST. An app that admits only ADMIN_EMAIL passes
  // `showContinueAs: false` and the probe never runs at all. See the
  // "WHY AN APP WOULD TURN THIS OFF" note above `showContinueAs` in the doc
  // comment, and WITUS_SHOW_CONTINUE_AS in src/lib/witus-sso.ts.
  if (input.showContinueAs === false) {
    return { attempt: false, skip: "continue-as-disabled" };
  }
  if (!input.endpoint) return { attempt: false, skip: "not-configured" };
  if (input.signedIn) return { attempt: false, skip: "already-signed-in" };
  if (input.attempted || hasAttemptMarker(input.search)) {
    return { attempt: false, skip: "already-attempted" };
  }
  return { attempt: true };
}

/**
 * Does this query string carry the one-shot marker? Accepts "?a=b" or "a=b".
 *
 * This is the half of the loop guard that survives a browser with no usable
 * sessionStorage (private modes throw on access) or a return into a different tab.
 */
export function hasAttemptMarker(search: string | null | undefined): boolean {
  if (typeof search !== "string" || search === "") return false;
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  return params.get(SSO_ATTEMPT_PARAM) === SSO_ATTEMPT_VALUE;
}

/** Add the one-shot marker to a same-origin path, preserving any query it already has. */
export function withAttemptMarker(path: string): string {
  const [beforeHash, ...hashRest] = path.split("#");
  const hash = hashRest.length > 0 ? `#${hashRest.join("#")}` : "";
  const [pathname, ...queryRest] = beforeHash.split("?");
  const params = new URLSearchParams(queryRest.join("?"));
  params.set(SSO_ATTEMPT_PARAM, SSO_ATTEMPT_VALUE);
  return `${pathname}?${params.toString()}${hash}`;
}

/**
 * Split a discovery URL into the IdP's origin and its better-auth basePath.
 *
 *   https://accounts.witus.online/api/idp/.well-known/openid-configuration
 *     -> { origin: "https://accounts.witus.online", basePath: "/api/idp" }
 *
 * Everything below derives from this instead of naming accounts.witus.online a
 * second time, so the only external value this app asserts stays the discovery URL
 * it is already configured with (authoritative-values rule).
 */
function splitDiscoveryUrl(
  discoveryUrl: string | null | undefined,
): { origin: string; basePath: string } | null {
  if (!discoveryUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(discoveryUrl);
  } catch {
    return null;
  }
  const cut = parsed.pathname.indexOf("/.well-known/");
  if (cut < 0) return null;
  return { origin: parsed.origin, basePath: parsed.pathname.slice(0, cut) };
}

/**
 * The ecosystem session probe: `<idp-origin>/api/ecosystem/session`.
 *
 * NOT better-auth's `<basePath>/get-session`. That endpoint emits no CORS headers
 * (only better-auth's MCP plugin does), so every browser discards the response;
 * and it must not be "fixed" by adding CORS, because it returns the full
 * `{ session, user }` and `session` carries the SESSION TOKEN — a credentialed
 * allow-origin there would let any ecosystem origin (or an XSS on one of them)
 * lift a live IdP session. `/api/ecosystem/session` is the purpose-built
 * replacement in gemini/witus: same cookie, answers with a display label and
 * nothing else, allow-origin list derived from the IdP's own client registry.
 *
 * Response shape: `{ signedIn: true, user: { name } }` or `{ signedIn: false }`.
 */
export function silentSsoEndpointFromDiscovery(
  discoveryUrl: string | null | undefined,
): string | null {
  const parts = splitDiscoveryUrl(discoveryUrl);
  if (!parts) return null;
  return `${parts.origin}/api/ecosystem/session`;
}

/**
 * The IdP's RP-initiated logout endpoint: `<basePath>/oauth2/endsession` — the
 * `end_session_endpoint` the discovery document advertises.
 *
 * BAM chose GLOBAL sign-out (2026-08-30): "signout signs out of every app".
 * Ending only this app's session leaves the shared IdP session alive, and with
 * "Continue as <name>" live that means signing out and coming back offers to sign
 * you straight back in — which reads as a broken logout.
 */
export function endSessionEndpointFromDiscovery(
  discoveryUrl: string | null | undefined,
): string | null {
  const parts = splitDiscoveryUrl(discoveryUrl);
  if (!parts) return null;
  return `${parts.origin}${parts.basePath}/oauth2/endsession`;
}

/**
 * Build the full end-session URL to navigate to.
 *
 * `origin` comes from `window.location.origin` at call time, so the redirect
 * target is always the host the person is actually on. That matters here: only
 * the hyphenated production host is registered with the IdP, and asserting a
 * hardcoded one would be a guess about a value another app owns.
 *
 * The TRAILING SLASH IS REQUIRED. better-auth exact-matches
 * `post_logout_redirect_uri` against the client's registered redirectUrls, and
 * gemini/witus registers `origin + "/"`. Drop the slash and the IdP returns 400.
 */
export function endSessionUrlForOrigin(
  endSessionEndpoint: string,
  origin: string,
): string {
  const back = `${origin.replace(/\/+$/, "")}/`;
  // `&`, not `?`, when the endpoint already carries client_id (see witus-sso.ts).
  const sep = endSessionEndpoint.includes("?") ? "&" : "?";
  return `${endSessionEndpoint}${sep}post_logout_redirect_uri=${encodeURIComponent(back)}`;
}

/**
 * Read a display name out of the probe response.
 *
 * Handles `{ signedIn, user: { name } }`, a bare user object, and the signed-out
 * answer (a 200 whose body has no user). Anything else yields null, which renders
 * the ordinary button.
 */
export function parseSilentSsoIdentity(payload: unknown): SsoIdentity | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.signedIn === false) return null;
  const candidate =
    root.user && typeof root.user === "object"
      ? (root.user as Record<string, unknown>)
      : root;
  const label = cleanLabel(candidate.name) ?? cleanLabel(candidate.email);
  return label ? { label } : null;
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_LABEL_LENGTH
    ? `${cleaned.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`
    : cleaned;
}

/** Button copy. Kept here so the test pins the exact string the visitor reads. */
export function continueAsLabel(identity: SsoIdentity | null): string {
  return identity ? `Continue as ${identity.label}` : "Sign in with WitUS";
}
