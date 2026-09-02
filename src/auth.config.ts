// src/auth.config.ts
// Slim Auth.js config — edge-safe (no adapter, no providers). Used by
// middleware to gate routes via the `authorized` callback. The full config
// (with the Drizzle adapter and Nodemailer email provider) lives in
// src/auth.ts and only runs in the Node.js route handlers.

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  // `error` is set so a failed sign-in lands on OUR page instead of Auth.js's raw
  // /api/auth/error (no message, no link back — a wall). /signin then reads the
  // ?error= code and branches: AccessDenied (the admin gate refusing a non-admin)
  // redirects to /waitlist, while Verification (an expired magic link) gets a
  // "send a fresh one" notice. ONE url serves EVERY code — verified in
  // @auth/core 0.41.2, where both of those errors have kind "error" — so the
  // branching is mandatory, not a nicety. See src/lib/auth-error.ts.
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/coach") ||
        pathname.startsWith("/api/coach") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/api/admin");
      if (isProtected) return Boolean(auth?.user);
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
