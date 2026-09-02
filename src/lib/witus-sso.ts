// src/lib/witus-sso.ts
// SERVER-ONLY resolution of the ecosystem-SSO endpoints from this app's env.
// Client components must never read the raw env, so the sign-in page and the
// gated pages resolve these here and pass the finished strings down as props.
//
// Both values are `null` unless WITUS_OIDC_CLIENT_ID is set — the same gate that
// hides the "Sign in with WitUS" button. An affordance the visitor cannot
// complete is worse than no affordance, so when this app is not a registered
// ecosystem OIDC client both features stay completely dark: no probe request is
// ever made, and sign-out stays purely local.
//
// This app is single-tenant and WitUS-branded (one product, one brand), so unlike
// learn.witus.online there is no per-tenant white-label gate on top.

import {
  endSessionEndpointFromDiscovery,
  silentSsoEndpointFromDiscovery,
} from "@/lib/silent-sso";

/**
 * Default OIDC discovery document for the ecosystem IdP.
 *
 * Named ONCE, here, and imported by src/auth.ts so the host is not asserted in a
 * second place. Everything else (the probe endpoint, the end-session endpoint) is
 * derived from whatever discovery URL this app is actually configured with.
 */
export const WITUS_OIDC_DISCOVERY_FALLBACK =
  "https://accounts.witus.online/api/idp/.well-known/openid-configuration";

/** The discovery URL in force: the env override if set, else the fallback above. */
export const witusDiscoveryUrl =
  process.env.WITUS_OIDC_DISCOVERY_URL || WITUS_OIDC_DISCOVERY_FALLBACK;

/** Is this app a configured ecosystem OIDC client? Gates both SSO features. */
export const witusSsoEnabled = Boolean(process.env.WITUS_OIDC_CLIENT_ID);

/**
 * Where the sign-in page's silent "Continue as ..." check asks the IdP who this
 * browser is. `null` when SSO is not configured (see the file header).
 */
export const witusSilentSsoEndpoint: string | null = witusSsoEnabled
  ? silentSsoEndpointFromDiscovery(witusDiscoveryUrl)
  : null;

/**
 * Where sign-out ends the SHARED WitUS session (BAM, 2026-08-30: signing out of
 * one WitUS app signs you out of all of them). `null` when SSO is not configured,
 * in which case sign-out falls back to today's purely-local behaviour.
 *
 * client_id IS REQUIRED, not optional: better-auth's endsession endpoint rejects a
 * `post_logout_redirect_uri` with `invalid_request` unless the request carries a
 * verifiable `id_token_hint` or an explicit `client_id`, and we have no id_token
 * client-side. It is baked in HERE, on the server, because the sign-out button is
 * a client component and must not be handed the raw env.
 *
 * `post_logout_redirect_uri` is NOT appended here — it is added at click time from
 * `window.location.origin` (see endSessionUrlForOrigin), because this app answers
 * on more than one hostname and only the registered one may be sent.
 */
export const witusEndSessionEndpoint: string | null = (() => {
  const clientId = process.env.WITUS_OIDC_CLIENT_ID;
  if (!clientId) return null;
  const base = endSessionEndpointFromDiscovery(witusDiscoveryUrl);
  if (!base) return null;
  return `${base}?client_id=${encodeURIComponent(clientId)}`;
})();
