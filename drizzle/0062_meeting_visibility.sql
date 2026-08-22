-- meetings.visibility: who may see a meeting outside its own attendee list.
--
-- 'workspace' — every signed-in teammate; the default, and exactly the
-- behaviour every existing row already had, which is why the backfill is the
-- default and nothing else.
-- 'attendees' — only people on the meeting. A quick note (one click, sole
-- attendee: its author) is born 'attendees': a private scratchpad has no
-- business on nineteen colleagues' calendars. Adding an attendee is what
-- shares it — visibility follows the list, no second switch to forget.
--
-- The column is nothing without its readers: enforcement lives in
-- meetingVisibleTo (src/features/meetings/visibility.ts), and
-- visibility.test.ts enumerates every file reading meetings the way
-- live.test.ts enumerates raw reads — a reader that skips the predicate has
-- to say why, in writing, or the suite fails.
ALTER TABLE "meetings" ADD COLUMN "visibility" text NOT NULL DEFAULT 'workspace';
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_visibility_check"
  CHECK ("visibility" IN ('workspace', 'attendees'));
