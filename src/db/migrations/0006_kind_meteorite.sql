CREATE TABLE "safety_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"triggers" text[] DEFAULT '{}' NOT NULL,
	"referral_included" boolean DEFAULT false NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"user_query_excerpt" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_session_id_coach_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coach_sessions"("id") ON DELETE cascade ON UPDATE no action;