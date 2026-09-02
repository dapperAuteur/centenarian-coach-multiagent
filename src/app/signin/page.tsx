// src/app/signin/page.tsx
// Server component. Renders "Sign in with WitUS" (the ecosystem OIDC IdP) when
// the client env is provisioned, above the email admin/waitlist form. The button
// is a server action that starts the OIDC flow via NextAuth's "witus" provider
// (configured in src/auth.ts). The email form lives in SignInForm.tsx (client).
//
// The button itself is WitusSsoButton (client), which adds the silent
// "Continue as <name>" check: it asks the IdP in parallel with this page whether
// the browser already has a WitUS session, and relabels the button if so. The
// probe endpoint is resolved HERE, on the server, and is null when this app is
// not a configured ecosystem OIDC client — a client component never reads the
// raw env, and the feature stays completely dark when it cannot be completed.

import { auth, signIn } from "@/auth";
import { witusSilentSsoEndpoint, witusSsoEnabled } from "@/lib/witus-sso";
import SignInForm from "./SignInForm";
import WitusSsoButton from "./WitusSsoButton";

export default async function SignInPage() {
  // Only used to skip the probe for someone who is already signed in here.
  const session = witusSsoEnabled ? await auth() : null;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-gray-500">
        This is a single-admin demo. Enter your email to continue.
      </p>

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
