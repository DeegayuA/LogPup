-- Module B, phase B1: sprint planning numbers.
--
-- capacity_points: what the team can take on this sprint ("Capacity 80").
-- committed_points / committed_at: the scope snapshot taken the moment a
-- sprint goes active ("Committed 72"). Without the snapshot, adding work
-- mid-sprint silently rewrites what was promised, and carry-over and the
-- burndown's starting point have nothing honest to measure against.
-- All nullable: a sprint planned before this column existed has no number,
-- and the UI says "not set" rather than inventing a zero.
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "capacity_points" numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "committed_points" numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "committed_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sprints" ADD CONSTRAINT "sprints_capacity_nonneg" CHECK ((capacity_points IS NULL) OR (capacity_points >= (0)::numeric));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
