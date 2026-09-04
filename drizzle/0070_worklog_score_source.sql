-- daily_worklogs.score_source — who said the day's percent.
--
-- The studio asked for days to be scored automatically from the hours logged
-- against them. That is a real trade and it was made knowingly: `percent` has
-- always meant "of what I set out to do, how much did I get done" — a
-- JUDGEMENT — while hours are a MEASUREMENT, and a day of firefighting is
-- honestly eight hours logged and 30% of the plan. Deriving one from the other
-- turns a self-assessment into a clock reading. It was accepted because days
-- carrying hours and no score sat on the catch-up ledger forever, and an
-- unclearable backlog is worse than an imprecise score.
--
-- THIS COLUMN IS WHAT KEEPS THE TRADE HONEST, and it does two jobs:
--
--   1. The derivation may only write a row that is ABSENT or already
--      'from_hours'. A person who scored their own Tuesday at 40% keeps that
--      number however many hours they later log against it. A measurement
--      silently overwriting somebody's own assessment of their day would be
--      strictly worse than the gap this feature closes.
--   2. Every surface that renders a score can LABEL a derived one. A division
--      presented as a self-assessment is the actual harm here — a manager
--      reading "100%" must be able to see that nobody claimed it.
--
-- DEFAULT 'self', which describes every existing row EXACTLY rather than
-- approximately: until auto-scoring shipped, the only way a percent reached
-- this table was somebody typing it. So there is no backfill, no ambiguity
-- about historical rows, and no window in which an old score could be mistaken
-- for a derived one.
--
-- A SEPARATE ENUM RATHER THAN A BOOLEAN. `auto_scored boolean` would answer
-- today's question and none of the next ones — a score drafted by AI and
-- accepted, or imported from a timesheet, are further sources, and adding a
-- value to an enum is cheaper than migrating a boolean into one later.
--
-- THE DO BLOCK IS FINE HERE, unlike in 0067/0068. Those could not be guarded
-- because ALTER TYPE ... ADD VALUE is not permitted inside a transaction block
-- on all paths; CREATE TYPE has no such restriction, so the ordinary
-- duplicate_object idiom gives this one replay safety.
DO $$ BEGIN
  CREATE TYPE "public"."worklog_score_source" AS ENUM('self', 'from_hours');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "daily_worklogs" ADD COLUMN IF NOT EXISTS "score_source" "public"."worklog_score_source" DEFAULT 'self' NOT NULL;
