"use server";

// Server action for signing out. Calling Auth.js signOut() directly (instead of
// linking to GET /api/auth/signout) skips the default sign-out confirmation page
// (the blank/black screen) and behaves the same on dev (HTTP) and prod (HTTPS),
// where the GET flow's CSRF + cookie handling differs.
//
// `redirect: false` — the action DESTROYS THE SESSION AND RETURNS, it does not
// navigate. Navigation is the caller's job (SignOutButton), because global
// sign-out has to leave this origin for the IdP afterwards and a redirect() here
// would pre-empt that. The session cookies are cleared on this action's response
// either way, so by the time the caller's `await` resolves the person is signed
// out here no matter what happens next.

import { signOut } from "@/auth";

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
}
