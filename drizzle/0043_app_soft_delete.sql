-- Deleting an app becomes soft, like everything else that can be deleted.
--
-- Before this there was no delete at all: an app could only be archived
-- (status = 'archived'), and the only way to remove one was a raw
-- `db.delete(apps)`, which cascades to sprints, tasks, meetings, assignments
-- and comments. That is unrecoverable, and it is the one shape admin Trash
-- exists to prevent — so the column arrives before the action does.
--
-- deleted_at is deliberately independent of status. Archiving retires an app
-- that still exists; deleting hides it from every read. An archived app can
-- still be deleted, and restoring one has to bring it back exactly as
-- archived as it went in, which a single status enum could not express.
--
-- deleted_by matches sprints/tasks/meetings: ON DELETE no action, because
-- losing the deleter's user row must not silently rewrite the record of who
-- deleted what.
--
-- Additive and replay-safe. Existing rows get NULL, which means "live", so
-- nothing changes at apply time.
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "deleted_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "apps" ADD CONSTRAINT "apps_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apps_live_name_idx" ON "apps" ("name") WHERE "deleted_at" is null;
