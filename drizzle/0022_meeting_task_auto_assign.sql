-- IF NOT EXISTS / guarded throughout — same reason as 0019 and 0021:
-- drizzle's own bookkeeping (drizzle.__drizzle_migrations) only records
-- 0000/0001 on this database, so every migration since has been applied by
-- hand outside the runner. This file must be safe to run against a database
-- that already has some or all of these columns/constraints.
ALTER TABLE "meeting_ai_notes" ADD COLUMN IF NOT EXISTS "auto_assign_capped_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_task_suggestions" ADD COLUMN IF NOT EXISTS "accepted_by" uuid;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "auto_assign_tasks" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_task_suggestions" ADD CONSTRAINT "meeting_task_suggestions_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
