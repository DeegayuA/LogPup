-- IF NOT EXISTS / guarded throughout — same reason as 0019 and 0021: parts of
-- this database's history were applied by hand outside the runner, so this file
-- must be safe to run against a database that already has some or all of these
-- columns, constraints and indexes.
--
-- The breakpoint markers between statements below are REQUIRED: drizzle-kit
-- splits a migration on them and sends one statement per round trip. Without
-- them the whole file is submitted as a single statement and the neon-http
-- driver runs only the first, which is how an "applied successfully" run can
-- leave every column below missing. Do not write that marker inside a comment
-- either — the splitter is a plain string split and will cut the file there.
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "meeting_note_segments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_note_segments" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "meeting_screenshots" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_screenshots" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_starts_live_idx" ON "meetings" ("starts_at") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "tasks_app_sprint_sort_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_app_sprint_sort_idx" ON "tasks" ("app_id","sprint_id","sort_order") WHERE "deleted_at" IS NULL;
