-- Project number: the owner's own reference for a project ("1042", "P-17"),
-- typed on the create form. Text, not integer, so a leading zero or a prefix
-- survives. Nullable because every existing project predates it.
--
-- Unique among LIVE projects only: a soft-deleted app keeps its number, and
-- that must not block reusing it on a replacement project.
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "project_number" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "apps_live_project_number_idx" ON "apps" ("project_number") WHERE "project_number" IS NOT NULL AND "deleted_at" IS NULL;
