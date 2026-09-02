"use client";

// src/components/SignOutButton.tsx
// The "Sign out" control in the /coach and /admin headers. Replaces the plain
// `<form action={signOutAction}>` those pages used, because global sign-out needs
// a second step AFTER the local session is destroyed.
//
// GLOBAL SIGN-OUT (BAM's decision, 2026-08-30: "signout signs out of every app").
// When `endSessionUrl` is present, signing out here also ends the shared session
// at the WitUS IdP, so signing out of the Coach signs you out of every WitUS app
// in this browser. The caller resolves that URL on the SERVER (src/lib/witus-sso.ts)
// and passes null when this app is not a configured ecosystem OIDC client — in
// which case there is no shared session to end and sign-out stays purely local,
// exactly as it behaves today.
//
// ORDER IS THE SAFETY PROPERTY. The local session is destroyed FIRST and the
// hand-off to the IdP happens only after. If the IdP is unreachable, refuses the
// logout, or the redirect never completes, the person is still signed out here.
// Never hand off first: that turns any IdP failure into "I clicked sign out and
// I'm still signed in."

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";
import { endSessionUrlForOrigin } from "@/lib/silent-sso";

export default function SignOutButton({
  endSessionUrl = null,
  className,
}: {
  /** IdP end-session endpoint (already carrying client_id), or null for local-only. */
  endSessionUrl?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Destroys the session cookies on this action's response. Everything
          // below happens only after that has landed.
          await signOutAction();

          if (endSessionUrl) {
            // A full navigation, not router.push: this leaves our origin for the
            // IdP, which then returns to `post_logout_redirect_uri`. The origin is
            // read at click time rather than baked in, because this app answers on
            // more than one hostname and the IdP exact-matches the value it gets.
            window.location.assign(
              endSessionUrlForOrigin(endSessionUrl, window.location.origin),
            );
            return;
          }

          // Local-only fallback: go to a PUBLIC page rather than refreshing in
          // place — re-rendering /coach or /admin signed-out just bounces to
          // /signin via middleware.
          router.push("/");
          router.refresh();
        })
      }
      className={
        className ??
        "cursor-pointer border-0 bg-transparent p-0 text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
      }
    >
      {pending
        ? "Signing out…"
        : endSessionUrl
          ? "Sign out of WitUS"
          : "Sign out"}
    </button>
  );
}
