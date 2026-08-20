-- Grade the deadline column the product already has, rather than adding a
-- second one. See docs/superpowers/specs/2026-08-20-deadlines-and-bugs-design.md.
--
-- `tasks.due_date` currently means two incompatible things: a date somebody
-- jotted into the quick-add ("friday"), and a date the studio promised a client
-- out loud. Five readers treat them identically, so an overdue list mixes a
-- private reminder with a broken commitment — and a list like that stops being
-- read, taking the dates that DID matter down with it.
--
-- One column with a grade, not two columns. Two date columns would force each
-- of those five readers to decide which one it means, and the first reader that
-- chooses wrong is a client date that silently stops being tracked.

-- 'target' — a working date, which is what every existing row is. That is why
-- it is the default: this migration must not silently promote history into
-- promises. 'committed' — a date with a counterparty, and a note naming them.
CREATE TYPE "public"."due_kind" AS ENUM('target', 'committed');
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_kind" "due_kind" DEFAULT 'target' NOT NULL;
--> statement-breakpoint

-- Who it was promised to, in words. Required by the action layer whenever
-- due_kind is 'committed' and meaningless otherwise, so it is nullable here:
-- the rule belongs beside the capability check that enforces it, not in a
-- CHECK constraint that would also have to know about the enum.
--
-- The promises view renders this text as its PRIMARY column, deliberately: a
-- commitment with no named counterparty then looks empty, because it is. The
-- failure being guarded against is 'committed' decaying into a seniority badge.
ALTER TABLE "tasks" ADD COLUMN "due_commitment_note" text;
--> statement-breakpoint

-- Written once, on the first NULL -> non-NULL transition of due_date, and never
-- touched again — not on a move, not on a clear, not on a trash restore, not on
-- reassignment. That is exactly what makes "we said the 12th, it is now the
-- 26th" answerable: every other candidate for that answer is destroyed by the
-- operations that make the question worth asking.
ALTER TABLE "tasks" ADD COLUMN "original_due_date" date;
--> statement-breakpoint

-- A RECOMPUTABLE CACHE over activity_log, never the record. Stated here so that
-- when the two disagree nobody argues about which wins: activity_log does.
-- Increments only on a non-NULL -> different non-NULL transition, so setting a
-- date for the first time and clearing one both leave it alone.
ALTER TABLE "tasks" ADD COLUMN "due_changed_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- The promises view asks one question: which commitments are still open,
-- soonest first. Partial on 'committed' because targets are the overwhelming
-- majority and none of them belong in that answer; partial on deleted_at
-- because this table is soft-deletable and a trashed task is not an
-- outstanding promise.
CREATE INDEX "tasks_committed_due_live_idx" ON "tasks" ("due_date")
  WHERE "due_kind" = 'committed' AND "deleted_at" IS NULL AND "due_date" IS NOT NULL;
