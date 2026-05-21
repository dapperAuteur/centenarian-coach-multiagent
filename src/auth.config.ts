// src/auth.config.ts
// Slim Auth.js config — edge-safe (no adapter, no providers). Used by
// middleware to gate routes via the `authorized` callback. The full config
// (with the Drizzle adapter and Nodemailer email provider) lives in
// src/auth.ts and only runs in the Node.js route handlers.

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/signin" },
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
