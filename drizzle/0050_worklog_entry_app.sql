-- Project attribution for a worklog entry.
--
-- WHY THIS IS NOT task_id. task_id exists only on category='task' rows, and is
-- ON DELETE SET NULL. So without this column a meeting about a project, a code
-- review on it, or a production incident — all genuinely that project's time —
-- could not be attributed at all, and deleting a task silently removed hours
-- from a project's history. Per-project cost undercounted with no way to see
-- it, and per-project effort mix read as ~100% 'task' because nothing else
-- could be counted. That contradicts the whole reason categories exist: a
-- meeting-heavy day is a full day's work.
--
-- NULLABLE on purpose: some time belongs to no project (admin, learning).
-- Forcing a choice would make people pick a wrong project, which is worse.
--
-- STORED ON EVERY ROW, including task rows, derived from the task's app at
-- write time rather than joined at read time: it survives the task being
-- deleted, and keeps project queries off a join through a nullable column.
-- Where the two later disagree, THIS value wins for historical figures — a
-- task moved between projects must not retroactively move hours somebody
-- logged against the old one.
ALTER TABLE "worklog_entries" ADD COLUMN IF NOT EXISTS "app_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "worklog_entries" ADD CONSTRAINT "worklog_entries_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "worklog_entries_app_day_live_idx" ON "worklog_entries" USING btree ("app_id","day") WHERE "deleted_at" is null;
