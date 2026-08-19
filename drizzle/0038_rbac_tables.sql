-- The five tables behind approval-gated edits and non-daily logging.
--
-- Replay-safe throughout, same discipline as 0019/0021-0034: every statement
-- must survive running again against a database where it already ran.
--
-- NONE of these tables gets a deleted_at, and SOFT_TABLES stays at five.
-- Each closes by a different mechanism, stated per table, because
-- "restorable from Trash" is the wrong answer for all five: a withdrawn
-- request and a revoked access grant are not lost content.
DO $$ BEGIN
	CREATE TYPE "public"."change_request_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."change_request_op" AS ENUM('edit', 'delete', 'restore');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."absence_kind" AS ENUM('annual', 'sick', 'unpaid', 'training', 'other_project', 'no_work_assigned', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."absence_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- CLOSES BY STATUS. A request is never deleted: 'withdrawn' is the requester
-- closing their own, 'rejected' is a reviewer declining it. The row IS the
-- audit trail, so removing it would destroy the record this table exists for.
CREATE TABLE IF NOT EXISTS "change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_label" text NOT NULL,
	"operation" "change_request_op" NOT NULL,
	"payload" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" "change_request_status" DEFAULT 'pending' NOT NULL,
	"app_id" uuid,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- CLOSES BY effective_to. Same half-open [from, to) shape as
-- app_role_history, including the one-open-row unique index, so moving to
-- part-time never rewrites what was expected of someone last month.
CREATE TABLE IF NOT EXISTS "work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pattern" jsonb NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"changed_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- CLOSES BY STATUS, like change_requests.
CREATE TABLE IF NOT EXISTS "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"kind" "absence_kind" NOT NULL,
	"reason" text,
	"status" "absence_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- REVOKED BY DELETE. A company holiday that was cancelled did not happen; a
-- tombstone would make every coverage read filter for it forever. Named in
-- live.test.ts's DELETE_ALLOWED_FUNCTIONS with that rationale.
CREATE TABLE IF NOT EXISTS "org_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_holidays_day_unique" UNIQUE("day")
);
--> statement-breakpoint
-- REVOKED BY DELETE, for the same reason webauthn_credentials is exempted:
-- this is an access key. A restorable grant is a key that can come back from
-- the dead, so revocation must be absolute.
CREATE TABLE IF NOT EXISTS "app_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_grants_user_app_unique" UNIQUE("user_id","app_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "absences" ADD CONSTRAINT "absences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "absences" ADD CONSTRAINT "absences_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "absences" ADD CONSTRAINT "absences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "org_holidays" ADD CONSTRAINT "org_holidays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "app_grants" ADD CONSTRAINT "app_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "app_grants" ADD CONSTRAINT "app_grants_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "app_grants" ADD CONSTRAINT "app_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- The approvals inbox reads pending-by-age; the per-entity trail answers
-- "what has been proposed against this row"; the requester index backs
-- "my requests".
CREATE INDEX IF NOT EXISTS "change_requests_status_created_idx" ON "change_requests" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_requests_entity_idx" ON "change_requests" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_requests_requester_idx" ON "change_requests" USING btree ("requester_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_schedules_user_from_idx" ON "work_schedules" USING btree ("user_id","effective_from");
--> statement-breakpoint
-- THE INVARIANT, copied from app_role_history_one_open_idx: at most one open
-- schedule per person. Two open rows would make "what was expected of them on
-- 12 June" ambiguous, which is the exact question coverage answers.
CREATE UNIQUE INDEX IF NOT EXISTS "work_schedules_one_open_idx" ON "work_schedules" USING btree ("user_id") WHERE "work_schedules"."effective_to" is null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "absences_user_start_idx" ON "absences" USING btree ("user_id","start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "absences_status_start_idx" ON "absences" USING btree ("status","start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_grants_user_idx" ON "app_grants" USING btree ("user_id");
