-- IF NOT EXISTS / guarded throughout — same reason as 0015, 0019, 0021 and
-- 0025: parts of this database's history were applied by hand outside the
-- runner, so this file must be safe to run against a database that already
-- has some or all of these columns, tables and indexes.
--
-- The breakpoint markers between statements below are REQUIRED: drizzle-kit
-- splits a migration on them and sends one statement per round trip. Without
-- them the whole file is submitted as a single statement and the neon-http
-- driver runs only the first, which is how an "applied successfully" run can
-- leave everything after it missing. Do not write that marker inside a
-- comment either — the splitter is a plain string split and will cut the
-- file there.
ALTER TABLE "meeting_attendees" ADD COLUMN IF NOT EXISTS "optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_attendee_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"score" integer NOT NULL,
	"score_det" integer NOT NULL,
	"tier" text NOT NULL,
	"hard_evidence_count" integer NOT NULL,
	"reasons" jsonb,
	"ai_override" jsonb,
	"ai_override_rejected" jsonb,
	"status" "suggestion_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_attendee_recommendations" ADD CONSTRAINT "meeting_attendee_recommendations_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_attendee_recommendations" ADD CONSTRAINT "meeting_attendee_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_attendee_recs_meeting_user_idx" ON "meeting_attendee_recommendations" USING btree ("meeting_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meeting_attendee_recs_meeting_surface_idx" ON "meeting_attendee_recommendations" USING btree ("meeting_id","surface");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meeting_note_segments_meeting_idx" ON "meeting_note_segments" USING btree ("meeting_id");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aliases" text[];
