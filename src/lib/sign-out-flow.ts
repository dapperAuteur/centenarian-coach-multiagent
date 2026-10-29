// src/lib/sign-out-flow.ts
// The two sign-outs, as pure steps so their ORDER is unit-tested without a
// browser (BAM, 2026-10-29, witus task 128 option (b)):
//
//   - "Sign out" ends ONLY this app's session, then goes to the public home
//     page. It never touches the IdP: other WitUS apps and the WitUS session
//     stay signed in, so the next "Sign in with WitUS" goes straight through.
//   - "Sign out of WitUS everywhere" ends this app's session, then sends the
//     browser to the IdP's end-session endpoint so the shared WitUS session
//     ends too. Offered only when the server resolved an end-session URL.
//
// This replaces the 2026-08-30 behaviour where the one plain button also ended
// the WitUS session. The buttons live in src/components/SignOutButton.tsx.

import { endSessionUrlForOrigin } from "@/lib/silent-sso";

/** "Sign out": local session, then the local destination. Never the IdP. */
export async function signOutHere(deps: {
  endLocalSession: () => Promise<unknown>;
  goLocal: () => void;
}): Promise<void> {
  // Awaited with its error swallowed. Go to a PUBLIC page either way:
  // re-rendering /coach or /admin signed-out just bounces to /signin.
  await deps.endLocalSession().catch(() => null);
  deps.goLocal();
}

/** "Sign out of WitUS everywhere": local session FIRST, then a full navigation to the IdP. */
export async function signOutEverywhere(deps: {
  endLocalSession: () => Promise<unknown>;
  endSessionUrl: string;
  origin: string;
  assign: (url: string) => void;
}): Promise<void> {
  // ORDER IS THE SAFETY PROPERTY. The local session is destroyed FIRST and the
  // hand-off to the IdP happens only after. If the IdP is unreachable, refuses
  // the logout, or the redirect never completes, the person is still signed
  // out here. Never hand off first: that turns any IdP failure into "I clicked
  // sign out and I'm still signed in."
  await deps.endLocalSession().catch(() => null);
  // A full navigation, not router.push: this leaves our origin for the IdP,
  // which then returns to `post_logout_redirect_uri` (`origin + "/"`).
  deps.assign(endSessionUrlForOrigin(deps.endSessionUrl, deps.origin));
}
