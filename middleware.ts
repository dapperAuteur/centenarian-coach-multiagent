// middleware.ts
// Gates /coach and /api/coach/* behind a signed-in session. Uses the slim
// edge-safe auth config — the Node-only adapter and email provider stay out
// of the middleware bundle.

import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/coach/:path*", "/api/coach/:path*"],
};
