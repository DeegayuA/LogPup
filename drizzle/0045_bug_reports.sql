-- Bug reports: what somebody hit, on which project, and how far it has got.
--
-- A table of its own rather than a flag on `tasks`. The two diverge on every
-- field that matters — a task is planned work with an assignee and a place in
-- a sprint, a bug is unplanned and arrives from whoever tripped over it — and
-- folding them together would drop every unplanned report into the sprint
-- counts the board uses to say whether the plan is on track. `linked_task_id`
-- carries the relationship instead: the task opened to FIX the bug.
--
-- Soft-deletable from the start (deleted_at/deleted_by), so it joins the
-- other six tables behind src/db/live.ts rather than being retrofitted later.
--
-- Idempotent throughout: enums via DO/EXCEPTION, table and indexes via IF NOT
-- EXISTS, so a partial apply can be re-run.
DO $$ BEGIN
	CREATE TYPE "bug_severity" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "bug_status" AS ENUM ('open', 'triaged', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" "bug_severity" DEFAULT 'medium' NOT NULL,
	"status" "bug_status" DEFAULT 'open' NOT NULL,
	"page_path" text,
	"reported_by" uuid NOT NULL,
	"assigned_to" uuid,
	"linked_task_id" uuid,
	"resolved_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_linked_task_id_tasks_id_fk" FOREIGN KEY ("linked_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_app_live_idx" ON "bug_reports" ("app_id","status","created_at") WHERE "deleted_at" is null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_reporter_idx" ON "bug_reports" ("reported_by") WHERE "deleted_at" is null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_status_idx" ON "bug_reports" ("status","created_at") WHERE "deleted_at" is null;
