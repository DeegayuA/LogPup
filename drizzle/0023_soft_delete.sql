-- IF NOT EXISTS / guarded throughout — same reason as 0019 and 0021:
-- drizzle's own bookkeeping (drizzle.__drizzle_migrations) only records
-- 0000/0001 on this database, so every migration since has been applied by
-- hand outside the runner. This file must be safe to run against a database
-- that already has some or all of these columns/constraints.
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
ALTER TABLE "meeting_note_segments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "meeting_note_segments" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
ALTER TABLE "meeting_screenshots" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "meeting_screenshots" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
CREATE INDEX IF NOT EXISTS "meetings_starts_live_idx" ON "meetings" ("starts_at") WHERE "deleted_at" IS NULL;
DROP INDEX IF EXISTS "tasks_app_sprint_sort_idx";
CREATE INDEX IF NOT EXISTS "tasks_app_sprint_sort_idx" ON "tasks" ("app_id","sprint_id","sort_order") WHERE "deleted_at" IS NULL;
