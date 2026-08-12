-- IF NOT EXISTS / guarded throughout — same reason as 0019, 0021 and 0022:
-- drizzle's own bookkeeping (drizzle.__drizzle_migrations) does not record
-- every applied migration on this database, so migrations get applied by
-- hand. This file must be safe to run against a database that already has
-- this column/constraint.
ALTER TABLE "meeting_task_suggestions" ADD COLUMN IF NOT EXISTS "suggested_app_id" uuid;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_task_suggestions" ADD CONSTRAINT "meeting_task_suggestions_suggested_app_id_apps_id_fk" FOREIGN KEY ("suggested_app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
