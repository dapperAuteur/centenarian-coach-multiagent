"use server";

// Server action for signing out. Calling Auth.js signOut() directly (instead of
// linking to GET /api/auth/signout) skips the default sign-out confirmation page
// (the blank/black screen) and behaves the same on dev (HTTP) and prod (HTTPS),
// where the GET flow's CSRF + cookie handling differs.

import { signOut } from "@/auth";

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
