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
