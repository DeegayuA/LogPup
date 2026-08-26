-- task_assignees: a task can belong to more than one person.
--
-- ADDITIVE. tasks.assignee_id is UNCHANGED and still means "the accountable
-- person" — every existing reader (board-view, task-workload, app-health, the
-- dashboard tiles) keeps working with no edit. This table is the FULL set and
-- always contains that person, so a reader that wants "everyone on it" joins
-- here and a reader that wants "whose is it" does not change.
--
-- Dropping assignee_id instead would mean rewriting every one of those readers
-- in the same commit as a schema change, on a database where migrations are
-- applied by hand. That is the version of this change that breaks production.
CREATE TABLE IF NOT EXISTS "task_assignees" (
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	-- Ordering the chips by when someone joined the task beats ordering by
	-- name: it keeps the person who was there first in the first slot.
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- Nullable: rows from the backfill below had no actor, and inventing one
	-- would attribute an assignment to somebody who never made it.
	"added_by" uuid,
	CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- The primary key already serves "who is on this task" (task_id leads it), but
-- nothing serves the reverse — "what is this person on", which is the read
-- behind every workload and my-work surface, and the one that runs per page
-- load per person. Without this index that read is a full scan of the whole
-- join table; it also gives the user_id foreign key an index to check against.
CREATE INDEX IF NOT EXISTS "task_assignees_user_idx" ON "task_assignees" USING btree ("user_id");
--> statement-breakpoint
-- Backfill: the invariant above ("this table is the FULL set and always
-- contains the accountable person") has to be true for rows that existed
-- before the table did. Without this every existing task reads as having
-- nobody on it — the multi-assignee UI would show an empty chip row for a
-- task that plainly has an owner. ON CONFLICT DO NOTHING makes it idempotent,
-- so re-running this migration against a database where it already landed is
-- a no-op rather than a failure.
INSERT INTO "task_assignees" ("task_id", "user_id")
SELECT "id", "assignee_id" FROM "tasks" WHERE "assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;
