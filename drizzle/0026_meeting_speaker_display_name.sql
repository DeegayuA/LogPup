-- IF NOT EXISTS, same reason as 0019/0021/0022/0024/0025: the bookkeeping
-- table is verified in sync on dev only, so this must survive being re-run
-- against a database where the column already exists.
ALTER TABLE "meeting_speakers" ADD COLUMN IF NOT EXISTS "display_name" text;
