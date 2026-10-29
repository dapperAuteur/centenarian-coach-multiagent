"use client";

// src/components/SignOutButton.tsx
// The sign-out controls in the /coach and /admin headers (BAM, 2026-10-29,
// witus task 128 option (b)):
//
//   - SignOutButton, "Sign out": ends ONLY this app's session and goes to "/".
//     It never navigates to the WitUS IdP and is always labelled "Sign out"
//     (except the transient "Signing out…").
//   - SignOutEverywhereButton, "Sign out of WitUS everywhere": ends this app's
//     session, THEN the shared WitUS session at the IdP. Renders nothing unless
//     the caller passes the end-session URL, which is resolved on the SERVER
//     (src/lib/witus-sso.ts) and is null when this app is not a configured
//     ecosystem OIDC client.
//
// The click order and its reasons live in src/lib/sign-out-flow.ts.

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";
import { signOutEverywhere, signOutHere } from "@/lib/sign-out-flow";

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutHere({
            // Destroys the session cookies on this action's response.
            endLocalSession: () => signOutAction(),
            goLocal: () => {
              router.push("/");
              router.refresh();
            },
          });
        })
      }
      className={
        className ??
        "cursor-pointer border-0 bg-transparent p-0 text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function SignOutEverywhereButton({
  endSessionUrl = null,
}: {
  /** IdP end-session endpoint (already carrying client_id), or null to hide this control. */
  endSessionUrl?: string | null;
}) {
  const helpId = useId();
  const [pending, startTransition] = useTransition();

  if (!endSessionUrl) return null;
  const url = endSessionUrl;

  return (
    <span className="flex max-w-56 flex-col gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-describedby={helpId}
        onClick={() =>
          startTransition(async () => {
            await signOutEverywhere({
              endLocalSession: () => signOutAction(),
              endSessionUrl: url,
              // Read at click time rather than baked in, because this app
              // answers on more than one hostname and the IdP exact-matches it.
              origin: window.location.origin,
              assign: (to) => window.location.assign(to),
            });
          })
        }
        className="cursor-pointer self-start border-0 bg-transparent p-0 text-left text-gray-500 underline hover:text-gray-800 disabled:opacity-50"
      >
        {pending ? "Signing out…" : "Sign out of WitUS everywhere"}
      </button>
      <span id={helpId} className="text-xs leading-snug text-gray-600">
        Also signs you out of WitUS. Other WitUS apps you are signed in to stay
        signed in until you sign out of them.
      </span>
    </span>
  );
}
