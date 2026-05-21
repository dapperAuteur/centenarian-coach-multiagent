// src/db/schema.ts
// Drizzle schema for the Centenarian Coach.
// Coach tables: coach_sessions, coach_specialist_calls, coach_kb.
// Auth.js tables (added with the email-link admin auth): user, account,
// session, verificationToken. Plus a waitlist table for non-admin emails.

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/** One row per coach query (one supervisor run). */
export const coachSessions = pgTable("coach_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  query: text("query").notNull(),
  routing: jsonb("routing"),
  finalAnswerText: text("final_answer_text"),
  consultedAgents: text("consulted_agents").array().notNull().default([]),
  langsmithRunId: text("langsmith_run_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** One row per specialist invocation within a session. */
export const coachSpecialistCalls = pgTable("coach_specialist_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => coachSessions.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull(),
  subQuestion: text("sub_question").notNull(),
  findingText: text("finding_text").notNull(),
  citations: jsonb("citations").notNull().default([]),
  toolCalls: jsonb("tool_calls").notNull().default([]),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Namespaced pgvector knowledge base. One table, namespace per specialist. */
export const coachKb = pgTable("coach_kb", {
  id: uuid("id").primaryKey().defaultRandom(),
  namespace: text("namespace").notNull(), // 'nutrition_kb' | 'workout_kb' | 'recovery_kb'
  source: text("source").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Single-row runtime configuration managed from the /admin dashboard:
 * which LLM provider and per-role models the coach uses, generation
 * defaults, and the LangSmith tracing toggle. Always exactly one row,
 * `id = 'singleton'`. If the row is absent (e.g. before this migration
 * runs) the app falls back to env-var defaults — see src/lib/settings.ts.
 */
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("singleton"),
  // 'anthropic' | 'google'. A COACH_LLM_PROVIDER env var, if set, overrides
  // this at runtime (keeps `pnpm eval` pinned to Gemini).
  provider: text("provider").notNull().default("anthropic"),
  // Record<provider, Record<role, modelId>>. Empty/partial slots fall back
  // to the built-in DEFAULT_MODELS map.
  models: jsonb("models").notNull().default({}),
  temperature: real("temperature").notNull().default(0),
  maxTokens: integer("max_tokens").notNull().default(1024),
  tracingEnabled: boolean("tracing_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Auth.js tables — standard @auth/drizzle-adapter schema.
// Only the admin (ADMIN_EMAIL) is allowed to actually sign in; the signIn
// callback in src/auth.ts enforces that. These tables back the magic-link
// flow (verificationToken in particular).
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------------------------------------------------------------------------
// Waitlist — emails that tried to sign in but are not ADMIN_EMAIL and asked
// to be notified when paid access is available.
// ---------------------------------------------------------------------------

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
