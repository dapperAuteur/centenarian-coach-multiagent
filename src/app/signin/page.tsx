// src/app/signin/page.tsx
// Server component. Renders "Sign in with WitUS" (the ecosystem OIDC IdP) when
// the client env is provisioned, above the email admin/waitlist form. The button
// is a server action that starts the OIDC flow via NextAuth's "witus" provider
// (configured in src/auth.ts). The email form lives in SignInForm.tsx (client).
//
// THIS PAGE IS ALSO THE FAILURE SURFACE. src/auth.config.ts sets
// `pages.error = "/signin"`, so every Auth.js sign-in failure comes back here with
// an `?error=<code>` instead of landing on the raw /api/auth/error page (no
// message, no link back — a wall). ONE url receives EVERY code, so the code has to
// be read and branched on: AccessDenied (the admin gate refused this WitUS
// account) is sent on to /waitlist, while Verification (an expired magic link)
// gets a "send a fresh one" notice and keeps the email flow intact. The mapping
// lives in src/lib/auth-error.ts and is pinned by tests/auth-error.test.ts.
//
// THE "Continue as <name>" PROBE IS OFF HERE, deliberately — see
// WITUS_SHOW_CONTINUE_AS in src/lib/witus-sso.ts for why an admin-gated app must
// not offer a personalized label it may refuse thirty seconds later.

import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { authErrorAction, errorCodeFromSearchParams } from "@/lib/auth-error";
import {
  WITUS_SHOW_CONTINUE_AS,
  witusSilentSsoEndpoint,
  witusSsoEnabled,
} from "@/lib/witus-sso";
import SignInForm from "./SignInForm";
import WitusSsoButton from "./WitusSsoButton";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const action = authErrorAction(
    errorCodeFromSearchParams(await searchParams),
  );

  // A refused non-admin never sees this page — they are routed to the waitlist and
  // asked whether they want to join (BAM, 2026-09-01).
  if (action?.kind === "redirect") redirect(action.to);

  // Only used to skip the probe for someone who is already signed in here — and
  // the probe only runs when this app opts into "Continue as <name>", which it
  // does not. Gated so the session read is not done for nothing.
  const session =
    witusSsoEnabled && WITUS_SHOW_CONTINUE_AS ? await auth() : null;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-gray-500">
        This is a single-admin demo. Enter your email to continue.
      </p>

      {action?.kind === "notice" && (
        <section
          role="alert"
          className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"
        >
          <p className="font-semibold text-gray-900">{action.title}</p>
          <p className="mt-1 text-gray-700">{action.body}</p>
        </section>
      )}

      {witusSsoEnabled && (
        <>
          <form
            action={async () => {
              "use server";
              await signIn("witus", { redirectTo: "/coach" });
            }}
            className="mt-6"
          >
            <WitusSsoButton
              silentCheckUrl={witusSilentSsoEndpoint}
              signedIn={Boolean(session?.user)}
              // OFF on this admin-gated app. Not a deletion — see
              // WITUS_SHOW_CONTINUE_AS. With `false` the component makes no
              // request to the IdP at all and the button keeps its plain label.
              showContinueAs={WITUS_SHOW_CONTINUE_AS}
            />
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            or
            <span className="h-px flex-1 bg-gray-200" />
          </div>
        </>
      )}

      <SignInForm />
    </main>
  );
}
