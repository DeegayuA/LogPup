-- Roadmap row order, independent of sprint dates. Replay-safe:
--
-- `ADD COLUMN IF NOT EXISTS` makes the column addition itself a no-op on
-- replay (drizzle-kit's own generated DDL omits `IF NOT EXISTS`; added by
-- hand here, same as the backfill below).
--
-- The `sort_order = 0` guard on the UPDATE makes the chronological seed a
-- no-op both on replay (every row already has a non-zero sort_order after
-- the first run) AND on any row a human has since drag-reordered to
-- position 0 in a way that happens to compute back to exactly 0 — the same
-- "0 means never seeded" convention `tasks.sort_order` already relies on
-- elsewhere in this schema.
--
-- row_number() is partitioned by app_id (each app's roadmap sorts
-- independently) and ordered by (start_date, id) — id as the tiebreaker so
-- two sprints sharing a start_date still get a deterministic, stable order
-- across repeated replays instead of whatever order Postgres happens to
-- return them in.
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE sprints s SET sort_order = r.rn * 1024
FROM (SELECT id, row_number() OVER (PARTITION BY app_id ORDER BY start_date, id) AS rn FROM sprints) r
WHERE s.id = r.id AND s.sort_order = 0;
