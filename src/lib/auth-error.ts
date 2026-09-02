// src/lib/auth-error.ts
// What /signin does with an `?error=<code>` that Auth.js put on the URL.
//
// WHY THIS FILE EXISTS. src/auth.config.ts now sets `pages.error = "/signin"`, so
// this app owns the failure surface instead of dumping people on Auth.js's raw
// /api/auth/error page (no message, no link back, no route to anything — a wall).
//
// THE COUPLING THIS MODULE UNTANGLES. `pages.error` is ONE url for EVERY failure.
// Verified against @auth/core 0.41.2 (node_modules/@auth/core/src/errors.ts and
// src/index.ts): the redirect target is `config.pages[error.kind ?? "error"]`, and
// BOTH `AccessDenied` (the admin gate refusing a non-admin) and `Verification` (an
// expired or already-used magic link) are plain `AuthError`s whose `kind` is
// "error". They arrive at the same page. Routing every code to the waitlist would
// therefore tell someone whose magic link merely expired that they have no
// access — so read the code and branch on it. That is this module's whole job.
//
// It is pure (no env, no next/*, no window) so tests/auth-error.test.ts can pin
// the mapping without a browser or a server.

/** What /signin should do about the error code on its URL. */
export type AuthErrorAction =
  | { kind: "redirect"; to: string }
  | { kind: "notice"; title: string; body: string };

/**
 * Where a refused non-admin goes.
 *
 * `?from=sso` is display context only — the waitlist page uses it to say "that
 * WitUS account doesn't have access here" rather than the generic invitation.
 * It is a query param a stranger can type, so it may never gate anything.
 */
export const WAITLIST_PATH = "/waitlist?from=sso";

/**
 * Map an Auth.js `?error=` code to what /signin should do.
 *
 * Returns `null` for "no error on this URL" — the ordinary sign-in page.
 *
 * The codes are @auth/core's client-safe error TYPES (errors.ts `clientErrors`):
 * AccessDenied, Verification, OAuthCallbackError, OAuthAccountNotLinked,
 * AccountNotLinked, CredentialsSignin, MissingCSRF, WebAuthnVerificationError.
 * Anything not client-safe is collapsed to "Configuration" before it reaches us.
 * An unknown code gets the generic notice rather than being ignored — a silent
 * sign-in page after a failed sign-in is the wall we are removing.
 */
export function authErrorAction(
  code: string | null | undefined,
): AuthErrorAction | null {
  if (typeof code !== "string" || code.trim() === "") return null;

  switch (code) {
    // The admin gate in src/auth.ts refused this account. This is the case BAM
    // asked for (2026-09-01): route them to the waitlist and ask.
    case "AccessDenied":
      return { kind: "redirect", to: WAITLIST_PATH };

    // MAGIC LINK, NOT ACCESS. The email flow must not regress into a waitlist
    // pitch: this person may well be the admin, holding a link that expired or
    // was already used (each link is single-use).
    case "Verification":
      return {
        kind: "notice",
        title: "That sign-in link has expired",
        body: "Sign-in links can only be used once, and they expire quickly. Enter your email below and we'll send a fresh one.",
      };

    // The app is misconfigured (missing secret, bad provider). Nothing the
    // visitor can do; say so plainly instead of blaming them.
    case "Configuration":
      return {
        kind: "notice",
        title: "Sign-in is misconfigured",
        body: "Something on our side is set up wrong, so sign-in cannot complete. This is not something you can fix — please try again later.",
      };

    // The WitUS round trip started but did not finish. Usually transient.
    case "OAuthCallbackError":
    case "OAuthSignin":
    case "OAuthCallback":
      return {
        kind: "notice",
        title: "Sign-in with WitUS did not complete",
        body: "The round trip to WitUS was interrupted. Try again, or use your email below.",
      };

    // Same address, two providers, and the WitUS account was never linked to it.
    case "OAuthAccountNotLinked":
    case "AccountNotLinked":
      return {
        kind: "notice",
        title: "That account is not linked",
        body: "This email already signed in here a different way. Use the email form below instead.",
      };

    default:
      return {
        kind: "notice",
        title: "Sign-in did not complete",
        body: "Something went wrong on the way back. Try again, or use your email below.",
      };
  }
}

/**
 * Read the `error` value out of a Next.js `searchParams` object.
 *
 * Next hands repeated params through as an array; take the first, ignore the
 * rest. Anything that is not a non-empty string is "no error".
 */
export function errorCodeFromSearchParams(
  params: Record<string, string | string[] | undefined> | undefined,
): string | null {
  const raw = params?.error;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
