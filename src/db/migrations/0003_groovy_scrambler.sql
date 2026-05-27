ALTER TABLE "coach_kb" ADD COLUMN "doc_index" integer;--> statement-breakpoint

-- Backfill existing rows. The previous seed script inserted rows in JSON
-- index order within each namespace, so created_at order matches the
-- original JSON index. row_number() over (partition by namespace) derives
-- it. Only touches rows whose doc_index is still NULL — safe to re-run.
WITH ordered AS (
  SELECT id,
         (row_number() OVER (PARTITION BY namespace ORDER BY created_at, id) - 1)::int AS idx
  FROM coach_kb
  WHERE doc_index IS NULL
)
UPDATE coach_kb
SET doc_index = ordered.idx
FROM ordered
WHERE coach_kb.id = ordered.id;--> statement-breakpoint

CREATE INDEX "coach_kb_namespace_doc_index_idx" ON "coach_kb" USING btree ("namespace","doc_index");
