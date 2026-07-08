// src/app/signin/page.tsx
// Server component. Renders "Sign in with WitUS" (the ecosystem OIDC IdP) when
// the client env is provisioned, above the email admin/waitlist form. The button
// is a server action that starts the OIDC flow via NextAuth's "witus" provider
// (configured in src/auth.ts). The email form lives in SignInForm.tsx (client).

import { signIn } from "@/auth";
import SignInForm from "./SignInForm";

const witusSsoEnabled = Boolean(process.env.WITUS_OIDC_CLIENT_ID);

export default function SignInPage() {
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
            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              Sign in with WitUS
            </button>
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
