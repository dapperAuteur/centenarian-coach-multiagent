CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "coach_kb" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" text NOT NULL,
	"source" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"routing" jsonb,
	"final_answer_text" text,
	"consulted_agents" text[] DEFAULT '{}' NOT NULL,
	"langsmith_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_specialist_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"agent_name" text NOT NULL,
	"sub_question" text NOT NULL,
	"finding_text" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_specialist_calls" ADD CONSTRAINT "coach_specialist_calls_session_id_coach_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coach_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_kb_namespace_idx" ON "coach_kb" ("namespace");--> statement-breakpoint
CREATE INDEX "coach_kb_embedding_idx" ON "coach_kb" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);--> statement-breakpoint
CREATE OR REPLACE FUNCTION match_coach_kb(query_embedding vector(768), namespace_filter text, match_count int DEFAULT 5)
RETURNS TABLE (id uuid, source text, content text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT id, source, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM coach_kb
  WHERE embedding IS NOT NULL AND namespace = namespace_filter
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;