-- Recurring meetings: a rule table, its standing invite list, and the two
-- columns that tie a materialised occurrence back to the rule that made it.
--
-- Design: docs/superpowers/specs/2026-08-22-recurring-meetings-design.md
--
-- Occurrences are REAL `meetings` rows, not computed ones. Fourteen tables
-- reference meetings.id; there is nowhere to attach a recording to a virtual
-- occurrence. That choice is what keeps "move one meeting" and "cancel one
-- meeting" as the update and soft delete that already exist.
--
-- Additive and inert. Every column added to `meetings` is nullable with no
-- default, so every existing row is a one-off exactly as it is today, and
-- nothing reads either new table until the series UI ships.
CREATE TABLE IF NOT EXISTS "meeting_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"app_id" uuid,
	"agenda" text,
	"meeting_url" text,
	"freq" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"by_weekday" integer[] DEFAULT '{}' NOT NULL,
	"monthly_mode" text,
	"time_zone" text DEFAULT 'Asia/Colombo' NOT NULL,
	"start_minutes" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"anchor_date" date NOT NULL,
	"until_date" date,
	"calendar_organiser_id" uuid NOT NULL,
	"google_calendar_id" text DEFAULT 'primary' NOT NULL,
	"auto_assign_tasks" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_series_attendees" (
	"series_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	CONSTRAINT "meeting_series_attendees_series_id_user_id_pk" PRIMARY KEY("series_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_calendar_organiser_id_users_id_fk" FOREIGN KEY ("calendar_organiser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_series_attendees" ADD CONSTRAINT "meeting_series_attendees_series_id_meeting_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."meeting_series"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_series_attendees" ADD CONSTRAINT "meeting_series_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "series_id" uuid;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "occurrence_key" date;--> statement-breakpoint
-- `set null`, NOT cascade. Deleting a series must not delete the meetings that
-- already happened under it: those rows carry notes, recordings and marked
-- attendance, and they are the record of something that occurred rather than
-- rows belonging to a rule.
DO $$ BEGIN
	ALTER TABLE "meetings" ADD CONSTRAINT "meetings_series_id_meeting_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."meeting_series"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- Deliberately NOT filtered on `deleted_at is null`. This index is what makes a
-- cancelled occurrence stay cancelled: once a slot has a row, live or trashed,
-- the horizon top-up can never insert a second one for the same slot. Filter it
-- and deleting next Tuesday's standup quietly brings it back the next time
-- anyone opens the calendar.
CREATE UNIQUE INDEX IF NOT EXISTS "meetings_series_occurrence_idx" ON "meetings" USING btree ("series_id","occurrence_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_series_idx" ON "meetings" USING btree ("series_id") WHERE "meetings"."deleted_at" is null;
