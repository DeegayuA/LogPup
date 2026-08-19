-- Cancelling a company holiday must not rewrite the past.
--
-- org_holidays feeds computeCoverage's isHoliday callback, which is evaluated
-- at READ time. Deleting a row therefore did not just lose the note saying why
-- a day was exempt — it made that day recompute as OWED, for everyone,
-- retroactively. Somebody correctly told they owed nothing on 26 August would
-- acquire a missing day months later with nothing on screen to explain it.
--
-- The row now survives revocation, and revoked_from is the day the
-- cancellation takes effect. Days before it stay holidays permanently: a
-- shutdown that has not happened yet can be called off, one people already
-- took cannot be un-held.
--
-- Additive and replay-safe. Existing rows have revoked_from NULL, which means
-- "still a holiday", so nothing changes at apply time.
ALTER TABLE "org_holidays" ADD COLUMN IF NOT EXISTS "revoked_from" date;
--> statement-breakpoint
ALTER TABLE "org_holidays" ADD COLUMN IF NOT EXISTS "revoked_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "org_holidays" ADD CONSTRAINT "org_holidays_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
