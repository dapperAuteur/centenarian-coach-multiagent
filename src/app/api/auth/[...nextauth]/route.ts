// src/app/api/auth/[...nextauth]/route.ts
// Auth.js v5 catch-all route handler — exposes /api/auth/* (signin, callback,
// session, csrf, signout, verify-request).

import { handlers } from "@/auth";

export const runtime = "nodejs";
export const { GET, POST } = handlers;
