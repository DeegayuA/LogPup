-- Takes become a thing the database knows about.
--
-- Until now a meeting's segments were ONE flat list numbered continuously from
-- zero, and the continuity was load-bearing: ai-actions.ts notes that
-- restarting a second take at index 0 would upsert straight over the first
-- take's transcripts and the meeting would lose the recording. Continuous
-- numbering prevents that collision, but it also means nothing records WHICH
-- segments belong to which take. A studio that presses record ten or fifteen
-- times in one meeting could not be shown its own takes, could not count them,
-- and could not remove one without hand-picking index ranges.
--
-- NOTHING IS BACKFILLED, ON PURPOSE. Existing segments keep recording_id NULL,
-- which reads as "recorded before takes were tracked" and is the truth. The
-- alternative -- inventing a take boundary from timestamps -- would produce
-- rows indistinguishable from observed ones, which is exactly the mistake
-- migration 0015 made with assignment_history and which cost a whole planned
-- feature its trustworthiness. A NULL here is honest; a guess would not be.
CREATE TABLE IF NOT EXISTS "meeting_recordings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "meeting_id" uuid NOT NULL REFERENCES "meetings"("id") ON DELETE cascade,
  "take_index" integer NOT NULL,
  "label" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid REFERENCES "users"("id")
);
--> statement-breakpoint
-- One take number per meeting, live or not. Deleted takes keep their slot so a
-- restore cannot collide with a take recorded after it, and so "take 7" means
-- the same thing to anybody who wrote it down.
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_recordings_meeting_take_idx"
  ON "meeting_recordings" ("meeting_id", "take_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meeting_recordings_meeting_live_idx"
  ON "meeting_recordings" ("meeting_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- SET NULL, never cascade. Deleting a take must not destroy the transcript
-- rows themselves: the soft delete below is what hides them, and a hard
-- cascade would make restore impossible and the admin trash a lie.
ALTER TABLE "meeting_recording_segments"
  ADD COLUMN IF NOT EXISTS "recording_id" uuid REFERENCES "meeting_recordings"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "meeting_recording_segments"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "meeting_recording_segments"
  ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
--> statement-breakpoint
-- The read behind every take card: this recording's live segments, in order.
CREATE INDEX IF NOT EXISTS "meeting_recording_segments_recording_live_idx"
  ON "meeting_recording_segments" ("recording_id", "index")
  WHERE "deleted_at" IS NULL;
