-- Two axes that are NOT the access seat, and must not be folded into it.
--
-- employment_type answers "what stage of employment is this person at";
-- user_role answers "what may they do". Encoding trainee-ness as a role value
-- would turn seven seats into twenty-eight and make every capability question
-- ask two things at once. It CAPS a seat, never grants — see capFor() in
-- src/features/auth/capabilities.ts.
--
-- work_schedules.logging answers "is a worklog expected from this person at
-- all", which is independent of WHICH days they work (pattern). A tech lead
-- who only assigns and monitors produces no daily_worklogs rows; without this
-- they read as `missing` every working day forever, and that one wrong row
-- poisons every org-level coverage number. Setting their pattern to zeros is
-- not the fix: that claims they are not working. They are working. They are
-- not logging.
--
-- Additive throughout. Every existing row keeps its current behaviour via the
-- defaults, so nothing changes at apply time and no backfill is needed.
DO $$ BEGIN
	CREATE TYPE "public"."employment_type" AS ENUM('permanent', 'probation', 'trainee', 'intern', 'contract');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."logging_expectation" AS ENUM('daily', 'none');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employment_type" "employment_type" DEFAULT 'permanent' NOT NULL;
--> statement-breakpoint
-- Required in the UI for trainee and intern, enforced in the action rather
-- than by a constraint: a check constraint here would make CHANGING someone's
-- employment type able to fail a migration, and the supervisor is a fact
-- about mentorship rather than about data integrity.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supervisor_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "users" ADD CONSTRAINT "users_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_supervisor_idx" ON "users" USING btree ("supervisor_id");
--> statement-breakpoint
ALTER TABLE "work_schedules" ADD COLUMN IF NOT EXISTS "logging" "logging_expectation" DEFAULT 'daily' NOT NULL;
