-- Calendar hardening: the organiser becomes its own fact, and a failed
-- calendar write becomes a fact on the row instead of a line in a log.
--
-- Every column here is additive and every default is chosen so that the day
-- this lands, behaviour is byte-for-byte what it was the day before. The
-- backfill makes calendar_organiser_id equal created_by, which is exactly what
-- makes it safe to ship ahead of the handover action that will move it.

ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "calendar_organiser_id" uuid REFERENCES "users"("id");
--> statement-breakpoint
UPDATE "meetings" SET "calendar_organiser_id" = "created_by" WHERE "calendar_organiser_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "calendar_organiser_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_calendar_organiser_idx" ON "meetings" ("calendar_organiser_id");
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "calendar_sync_state" text;
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "calendar_synced_at" timestamp;
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "calendar_error" text;
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "google_calendar_id" text DEFAULT 'primary' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_token_status" text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_scopes" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_checked_at" timestamp;
--> statement-breakpoint
UPDATE "users" SET "google_token_status" = 'none' WHERE "google_refresh_token" IS NULL;
