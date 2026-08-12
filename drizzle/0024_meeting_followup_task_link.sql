-- IF NOT EXISTS / guarded, same reason as 0010/0019/0021/0022: drizzle's own
-- migration ledger only records 0000/0001 on this database, so everything
-- since has been applied by hand outside the runner. Must be safe to run
-- against a database that already has this column/constraint.
ALTER TABLE "meeting_followups" ADD COLUMN IF NOT EXISTS "resolved_by_task_id" uuid;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_followups" ADD CONSTRAINT "meeting_followups_resolved_by_task_id_tasks_id_fk" FOREIGN KEY ("resolved_by_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
