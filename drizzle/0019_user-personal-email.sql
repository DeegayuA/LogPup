-- IF NOT EXISTS because drizzle's own bookkeeping (drizzle.__drizzle_migrations)
-- has only ever recorded 0000 and 0001 on this database — every migration since
-- was applied outside the runner, so `drizzle-kit migrate` restarts at 0002 and
-- dies on "already exists". Until that is backfilled, this statement has to be
-- safe to run against a database that already has the column.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personal_email" text;
