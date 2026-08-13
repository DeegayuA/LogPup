-- Project Manager (PM) on every app.
--
-- Added nullable first, backfilled from the existing lead_id, then locked to
-- NOT NULL in this same file — no window where the column exists but is
-- optional. Safe to make NOT NULL in one shot because every app already has
-- a lead: verified against the dev DB before writing this file (2 apps, both
-- with a non-null lead_id) — see the migration verification in
-- .superpowers/app-pm-report.md. A studio with an app that somehow has
-- neither a lead nor a pm would fail this migration's last statement rather
-- than silently leaving a required column nullable; that is the intended
-- failure mode, not a bug to guard against here.
--
-- Replay-safe throughout, same discipline as 0019/0021-0032: every statement
-- must survive running again against a database where it already ran.
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "pm_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "apps" ADD CONSTRAINT "apps_pm_id_users_id_fk" FOREIGN KEY ("pm_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
UPDATE "apps" SET "pm_id" = "lead_id" WHERE "pm_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "apps" ALTER COLUMN "pm_id" SET NOT NULL;
