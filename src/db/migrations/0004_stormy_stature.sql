ALTER TABLE "app_settings" ADD COLUMN "corpus_mode" text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_kb" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX "coach_kb_namespace_visibility_idx" ON "coach_kb" USING btree ("namespace","visibility");--> statement-breakpoint

-- Re-create the retrieval function with a visibility filter. The old 3-arg
-- version is dropped and replaced by a 4-arg one; visibility_filter defaults
-- to 'both' (no filter) so any caller that omits it keeps prior behavior.
-- 'public'/'private' restrict results to rows with that visibility.
DROP FUNCTION IF EXISTS match_coach_kb(vector, text, integer);--> statement-breakpoint
CREATE OR REPLACE FUNCTION match_coach_kb(query_embedding vector(768), namespace_filter text, match_count int DEFAULT 5, visibility_filter text DEFAULT 'both')
RETURNS TABLE (id uuid, source text, content text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT id, source, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM coach_kb
  WHERE embedding IS NOT NULL
    AND namespace = namespace_filter
    AND (visibility_filter = 'both' OR visibility = visibility_filter)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;