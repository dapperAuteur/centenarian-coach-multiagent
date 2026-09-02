"use client";

// src/app/signin/WitusSsoButton.tsx
// The submit button for the existing "Sign in with WitUS" form in page.tsx, plus
// the silent "Continue as <name>" check layered on top of it.
//
// IT IS STILL THE SAME BUTTON AND THE SAME FLOW. The form's server action
// (`signIn("witus", ...)`, page.tsx) is untouched: this component only changes the
// button's LABEL when the IdP says someone is already signed in, and writes the
// loop-guard marker on the way out. Clicking always runs the real OIDC code flow.
//
// WHAT THE VISITOR SEES. The form is already on screen and nothing here delays it.
// The button says "Sign in with WitUS" from first paint. If the probe comes back
// with a WitUS session it becomes "Continue as <name>". If the probe fails, times
// out, or is blocked by the browser's third-party-cookie rules, nothing changes
// and nothing is said — no error, no spinner, no layout shift. A failed silent
// check is invisible; that is the requirement, and it is the common case.
//
// THE NAME IS DISPLAY COPY, NEVER A CREDENTIAL. See src/lib/silent-sso.ts.

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  SILENT_SSO_TIMEOUT_MS,
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  parseSilentSsoIdentity,
  silentSsoDecision,
  type SsoIdentity,
} from "@/lib/silent-sso";

export default function WitusSsoButton({
  silentCheckUrl,
  signedIn = false,
}: {
  /**
   * IdP session endpoint, resolved on the SERVER (src/lib/witus-sso.ts). `null`
   * when this app is not a configured ecosystem OIDC client, in which case no
   * request is made at all.
   */
  silentCheckUrl: string | null;
  /** Already signed in here? Then there is nothing to ask the IdP. */
  signedIn?: boolean;
}) {
  const { pending } = useFormStatus();
  const [identity, setIdentity] = useState<SsoIdentity | null>(null);

  useEffect(() => {
    const endpoint = silentCheckUrl;
    const decision = silentSsoDecision({
      endpoint,
      search: window.location.search,
      attempted: readAttempted(),
      signedIn,
    });
    // `!endpoint` is already implied by decision.attempt; repeating it keeps the
    // narrowing the compiler's rather than a cast that could outlive the invariant.
    if (!decision.attempt || !endpoint) return;

    // Abort rather than hang. A probe still in flight after the visitor has moved
    // on is a leak of attention, not just of a socket.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SILENT_SSO_TIMEOUT_MS);
    let live = true;

    // `credentials: "include"` is the entire mechanism: the answer depends on the
    // IdP's OWN cookie, which is third-party from here. Browsers that partition or
    // block third-party cookies (Safari ITP, Firefox Total Cookie Protection)
    // answer "nobody", and that is a supported outcome, not a bug to work around.
    fetch(endpoint, {
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!live) return;
        const found = parseSilentSsoIdentity(payload);
        // NEVER a credential — display copy for a button whose click runs the
        // real OIDC code flow.
        if (found) setIdentity(found);
      })
      .catch(() => {
        // Invisible on purpose: network error, CORS refusal, abort, non-JSON body.
        // All the same outcome — the ordinary button.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [silentCheckUrl, signedIn]);

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        // THE LOOP GUARD, written BEFORE the redirect, never after the return. A
        // marker written on return never exists when the return is the thing that
        // failed. Without it a visitor whose IdP session has gone stale gets:
        // probe says "Continue as X" -> click -> the IdP cannot finish -> back to
        // /signin -> probe says "Continue as X" -> forever. With it, one attempt
        // per tab; the second render offers the plain button and the email form,
        // which always work. This runs before the form submits.
        onClick={writeAttempted}
        className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50"
      >
        {pending ? "Redirecting…" : continueAsLabel(identity)}
      </button>
      {/* Always in the DOM so the label change is announced when it happens, and
          silent (and invisible) when the probe found nothing. */}
      <p
        role="status"
        aria-live="polite"
        className={identity ? "mt-2 text-center text-xs text-gray-500" : "sr-only"}
      >
        {identity ? "Not you? Use your email below instead." : ""}
      </p>
    </>
  );
}

/**
 * sessionStorage throws outright in some privacy modes, so both halves are
 * wrapped. A browser that cannot remember the attempt still gets the other half of
 * the guard: a `?sso=tried` marker on the URL (silentSsoDecision reads it).
 */
function readAttempted(): boolean {
  try {
    return window.sessionStorage.getItem(SSO_ATTEMPT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAttempted(): void {
  try {
    window.sessionStorage.setItem(SSO_ATTEMPT_STORAGE_KEY, "1");
  } catch {
    // No storage, no marker. The query-param half still applies.
  }
}
