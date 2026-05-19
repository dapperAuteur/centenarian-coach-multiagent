// src/db/schema.ts
// Drizzle schema for the Centenarian Coach (PRD-2 v2, Section 8).
// Demo mode: no auth, no RLS, no user_id columns.

import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

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
