-- Removing a person from the workspace, recorded BESIDE the user rather than
-- as a deleted_at column on `users`.
--
-- Every other soft-deleted table here carries deleted_at and is read through a
-- live* subquery, and src/db/live.test.ts enforces that a table with deleted_at
-- is registered and filtered everywhere. That is right for apps, tasks and
-- meetings and wrong for people: `users` is joined by around a hundred reads
-- whose job is ATTRIBUTION — who wrote this comment, who logged this day, who
-- was in this meeting. Filtering a removed person out of those joins would not
-- hide them, it would blank the record of what they did. Somebody leaving does
-- not un-write their work.
--
-- Directories, member pickers, assignment targets and sign-in exclude anyone
-- with an OPEN row here. Attribution joins never consult this table.
--
-- An interval, not a flag: restored_at closes it, the same shape as
-- app_role_history and assignment_history.
--
-- NOT deactivation. A deactivated account still signs in and is shown that it
-- is deactivated (users.active). A removed one cannot sign in at all.
CREATE TABLE IF NOT EXISTS "user_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"removed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_by" uuid,
	"reason" text,
	"restored_at" timestamp with time zone,
	"restored_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_deletions" ADD CONSTRAINT "user_deletions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_deletions" ADD CONSTRAINT "user_deletions_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_deletions" ADD CONSTRAINT "user_deletions_restored_by_users_id_fk" FOREIGN KEY ("restored_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- AT MOST ONE open removal per person. Without it, removing an already-removed
-- account opens a second interval and the restore that follows closes only one
-- of them, leaving somebody removed with no row saying why.
CREATE UNIQUE INDEX IF NOT EXISTS "user_deletions_one_open_idx" ON "user_deletions" ("user_id") WHERE "restored_at" is null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_deletions_removed_at_idx" ON "user_deletions" ("removed_at");
