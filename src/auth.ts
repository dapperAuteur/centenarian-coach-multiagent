// src/auth.ts
// Full Auth.js v5 config — Node.js only. Magic-link sign-in via Nodemailer
// (Mailgun SMTP) with the Drizzle adapter. The `signIn` callback enforces
// the single-admin gate as defense-in-depth — the /signin page already
// refuses to send a magic link to anyone other than ADMIN_EMAIL.

import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { authConfig } from "@/auth.config";
import { getDb } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
    // "Sign in with WitUS" — the ecosystem OIDC IdP (accounts.witus.online,
    // mounted under /api/idp). Added only when the client env is provisioned, so
    // a missing secret never breaks the build and the button stays hidden until
    // BAM sets the env (incremental rollout — see
    // gemini/witus/lib/identity/clients.ts). NOTE: the signIn callback below still
    // gates completion to ADMIN_EMAIL, so WitUS SSO succeeds only for the admin.
    ...(process.env.WITUS_OIDC_CLIENT_ID
      ? [
          {
            id: "witus",
            name: "WitUS",
            type: "oidc" as const,
            issuer: "https://accounts.witus.online/api/idp",
            wellKnown:
              process.env.WITUS_OIDC_DISCOVERY_URL ??
              "https://accounts.witus.online/api/idp/.well-known/openid-configuration",
            clientId: process.env.WITUS_OIDC_CLIENT_ID,
            clientSecret: process.env.WITUS_OIDC_CLIENT_SECRET ?? "",
            authorization: { params: { scope: "openid email profile" } },
            checks: ["pkce", "state"] as ("pkce" | "state")[],
            profile(profile: {
              sub: string;
              email?: string | null;
              name?: string | null;
            }) {
              return {
                id: profile.sub,
                email: profile.email ?? null,
                name: profile.name ?? null,
              };
            },
          } satisfies import("next-auth/providers").OIDCConfig<{
            sub: string;
            email?: string | null;
            name?: string | null;
          }>,
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // Only ADMIN_EMAIL can complete sign-in. The /signin page already
      // refuses to *send* magic links to other addresses; this is the
      // server-side enforcement at click time.
      return Boolean(user.email && user.email === process.env.ADMIN_EMAIL);
    },
  },
});
