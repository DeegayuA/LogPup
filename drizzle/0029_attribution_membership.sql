-- Attribution truth & membership.
--
-- Every statement in this file is written to be REPLAYED safely: the
-- __drizzle_migrations bookkeeping in this project is known to have been out
-- of sync (note the missing 0011 in meta/_journal.json), and a prior session
-- was burned by a migration that could only run once. DDL is guarded with
-- IF NOT EXISTS / duplicate_object handlers in the same style as 0014; the
-- data statements are idempotent by construction — their WHERE clauses stop
-- matching once they have been applied.
--
-- meeting_attendee_history_one_open_idx mirrors the partial-unique index 0016
-- added to assignment_history, and is declared in schema.ts the same way. It
-- makes "at most one open row per (meeting, user)" a rule the database
-- enforces rather than a convention every writer has to remember.

DO $$ BEGIN
 CREATE TYPE "public"."attendance_change" AS ENUM('added', 'updated', 'removed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_attendee_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"response" "attendee_response" NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"changed_by" uuid NOT NULL,
	"change_kind" "attendance_change" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_attendee_history" ADD CONSTRAINT "meeting_attendee_history_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_attendee_history" ADD CONSTRAINT "meeting_attendee_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meeting_attendee_history" ADD CONSTRAINT "meeting_attendee_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meeting_attendee_history_user_from_idx" ON "meeting_attendee_history" USING btree ("user_id","effective_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meeting_attendee_history_meeting_from_idx" ON "meeting_attendee_history" USING btree ("meeting_id","effective_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meeting_attendee_history_as_of_idx" ON "meeting_attendee_history" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_attendee_history_one_open_idx" ON "meeting_attendee_history" USING btree ("meeting_id","user_id") WHERE "meeting_attendee_history"."effective_to" is null;

--> statement-breakpoint

-- BACKFILL: one open 'added' row per existing attendee, so meeting membership
-- history is not empty on day one.
--
-- effective_from = the meeting's created_at, and changed_by = its creator:
-- createMeeting writes the meeting row and its attendee rows in ONE db.batch,
-- so for every row that has ever existed this is when and by whom it was
-- written. That is stronger than the assignment_history backfill (whose actor
-- had to be inferred from the app lead) but still not certain — the live
-- table cannot distinguish an original attendee from one added later — so
-- each row carries a note saying it was backfilled.
--
-- created_at on meetings is `timestamp` while effective_from is `timestamptz`;
-- AT TIME ZONE 'UTC' reads the naive value as UTC, matching how the app
-- writes it (same conversion as the 0015 backfill).
--
-- NOT EXISTS guard: replay must not double-insert, and it is also what keeps
-- this compatible with the one-open unique index above.
INSERT INTO "meeting_attendee_history"
  ("meeting_id", "user_id", "response", "effective_from", "effective_to",
   "changed_by", "change_kind", "note")
SELECT
  a."meeting_id",
  a."user_id",
  a."response",
  m."created_at" AT TIME ZONE 'UTC',
  NULL,
  m."created_by",
  'added',
  'Backfilled from the live attendee row when meeting membership history was introduced. effective_from is the meeting''s creation instant and the actor is its creator — correct for attendees added with the meeting, an approximation for any added later.'
FROM "meeting_attendees" a
JOIN "meetings" m ON m."id" = a."meeting_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "meeting_attendee_history" h
  WHERE h."meeting_id" = a."meeting_id" AND h."user_id" = a."user_id"
);
--> statement-breakpoint

-- ATTRIBUTION REPAIR (1/2): un-attribute every note segment whose speaker was
-- GUESSED rather than confirmed.
--
-- resolveSpeakerUserId used to fall back to name-matching a speaker label
-- against the meeting's attendees when no meeting_speakers row existed, so a
-- model-invented label that happened to match an attendee name rendered as
-- established fact. The rows that came from that fallback are exactly the ones
-- carrying a speaker_id whose label has no meeting_speakers row — a row exists
-- there if and only if a human has looked at the label, so every
-- human-assigned attribution survives untouched.
--
-- speaker_label IS NOT NULL matters: `label = NULL` is never true, so without
-- it a segment with a speaker_id and no label would match NOT EXISTS and be
-- wiped. Such a row was never label-resolved and is therefore not in the
-- target set. (No current writer produces that shape; the guard removes the
-- trap for any that ever does.)
--
-- Scoped to meeting_note_segments only. meeting_recording_segments (0017)
-- holds raw per-chunk transcripts with no speaker or assignee column at all,
-- so there is nothing there to repair.
--
-- Idempotent: once a row's speaker_id is NULL it no longer matches.
UPDATE "meeting_note_segments" s SET "speaker_id" = NULL
WHERE s."speaker_id" IS NOT NULL
  AND s."speaker_label" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "meeting_speakers" m
    WHERE m."meeting_id" = s."meeting_id" AND m."label" = s."speaker_label"
  );
--> statement-breakpoint

-- ATTRIBUTION REPAIR (2/2): the same guess propagated into task suggestions —
-- suggestedUserId came from the same function, so a wrong guess pre-assigned a
-- real task to the wrong person. An unconfirmed suggestion reverts to
-- Unassigned.
--
-- Two deliberate departures from the segment statement above:
--
--   1. meeting_task_suggestions has NO label column. The assignee label the
--      model produced was consumed at insert time and never stored, so "the
--      label has no mapping" cannot be expressed here. The closest honest
--      predicate is "no human has confirmed this person is even a speaker in
--      this meeting", which is conservative in the right direction.
--   2. status = 'open' only. An 'accepted' suggestion already became a real
--      task; rewriting its suggested_user_id would falsify the record of what
--      was accepted, and accepted tasks keep their assignee by design. A
--      'dismissed' one is inert.
--
-- Idempotent for the same reason as above.
UPDATE "meeting_task_suggestions" t SET "suggested_user_id" = NULL
WHERE t."suggested_user_id" IS NOT NULL
  AND t."status" = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM "meeting_speakers" m
    WHERE m."meeting_id" = t."meeting_id" AND m."user_id" = t."suggested_user_id"
  );
--> statement-breakpoint

-- ATTRIBUTION REPAIR (3/3): the third surface the same guess reached.
-- deriveAndInsertFollowups set meeting_followups.user_id by name-matching the
-- model's perPerson[].name / questions[].person against the source meeting's
-- attendees. A follow-up is a claim that a specific person OWES something, and
-- it carries forward to every future meeting they attend — so a wrong match
-- didn't just mislabel one row, it followed an innocent person around.
--
-- THERE IS NO "unactioned" FLAG, so the target set is built from three
-- conditions, narrowest first:
--
--   created_by IS NULL — the precise discriminator. Human-added follow-ups
--     (addFollowup) always carry the actor AND an explicitly picked person;
--     they were never name-matched and must not be touched. Only AI-derived
--     rows have a null actor, and those are exactly the rows that went
--     through matchPersonToAttendee.
--   status = 'open' — a resolved item is a closed record. Rewriting who owed
--     it would falsify history, the same reason the suggestion reset above is
--     scoped to open cards.
--   response_note IS NULL AND defer_reason IS NULL — an OPEN item can still
--     have been worked: someone recorded what the person said, or why it
--     isn't done. That is a human having engaged with this attribution, which
--     is as good as confirming it. Clearing user_id would orphan their note.
--
-- Plus the same "no mapping vouches for them" test as the statements above.
-- personName is never touched — the model's raw guess is preserved verbatim
-- and now renders as a label, and the row stays assignable by a human
-- (assignFollowupPerson).
--
-- Idempotent: once user_id is NULL the row no longer matches.
UPDATE "meeting_followups" f SET "user_id" = NULL
WHERE f."user_id" IS NOT NULL
  AND f."created_by" IS NULL
  AND f."status" = 'open'
  AND f."response_note" IS NULL
  AND f."defer_reason" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "meeting_speakers" m
    WHERE m."meeting_id" = f."source_meeting_id" AND m."user_id" = f."user_id"
  );
