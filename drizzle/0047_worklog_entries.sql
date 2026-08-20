-- Where the hours actually went — many entries per person per day.
--
-- Hangs off (user_id, day), NOT off a daily_worklogs.id: logging time must
-- never require the header row to exist first, and backfilling a day you
-- never self-scored is the normal case after leave.
--
-- MINUTES, NOT HOURS. 90 beats 1.5 for a person typing it, and an integer
-- column cannot drift the way a float does once a month of half-hours is
-- summed. Every consumer divides by 60 at the edge, never in storage.
--
-- A TIME ENTRY DOES NOT REQUIRE A TASK. That is the design's first
-- commitment: a tech lead whose Tuesday was four meetings, two reviews and an
-- incident closed no ticket and moved no card, and a model that only counts
-- task-linked time computes their honest full day as zero. `category` carries
-- the non-task cases and every one of them counts toward the day.
--
-- The category/task rule (`task` requires task_id, every other category
-- forbids it) is enforced in the ACTION, deliberately not by a CHECK
-- constraint: task_id is ON DELETE SET NULL, so a task deleted next year
-- would retroactively make an old row violate its own constraint and become
-- unsavable. A rule about what you may WRITE must not become a rule about
-- what may continue to EXIST.
DO $$ BEGIN
	CREATE TYPE "public"."worklog_entry_category" AS ENUM('task', 'meeting', 'review', 'support', 'admin', 'learning', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- Lets us later measure how often an AI draft is accepted unedited — the only
-- honest way to tell whether the drafting feature helps or just makes work.
DO $$ BEGIN
	CREATE TYPE "public"."worklog_entry_source" AS ENUM('manual', 'ai_suggested');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- `billable` lands NOW rather than in a second migration: the project cost and
-- worth design derives earned value from exactly this flag, and adding it
-- later means an ALTER on a table that by then holds every hour anybody has
-- logged, with no defensible value to backfill. false is the safe default —
-- an entry counts as earning nothing until somebody says otherwise.
CREATE TABLE IF NOT EXISTS "worklog_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"minutes" integer NOT NULL,
	"task_id" uuid,
	"category" "worklog_entry_category" NOT NULL,
	"billable" boolean DEFAULT false NOT NULL,
	"note" text,
	"source" "worklog_entry_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "worklog_entries" ADD CONSTRAINT "worklog_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- SET NULL, never cascade: deleting a task must not delete the record that
-- somebody spent three hours on it. The hours were still worked, and the
-- category still says what kind of work it was.
DO $$ BEGIN
	ALTER TABLE "worklog_entries" ADD CONSTRAINT "worklog_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- The day editor's only read: one person, one day (or one month's range).
-- Partial on live rows because every read of this table filters soft-deleted
-- ones out — an unfiltered index would carry rows no query ever wants.
CREATE INDEX IF NOT EXISTS "worklog_entries_user_day_live_idx" ON "worklog_entries" USING btree ("user_id","day") WHERE "deleted_at" is null;
--> statement-breakpoint
-- "How many hours went into this task", which is what the cost and effort
-- reports are built on.
CREATE INDEX IF NOT EXISTS "worklog_entries_task_live_idx" ON "worklog_entries" USING btree ("task_id") WHERE "deleted_at" is null;
