-- Work substrate, wave A: the columns and indexes four other workstreams are
-- waiting on.
--
-- Design: docs/superpowers/specs/2026-08-20-work-substrate-design.md
--
-- ADDITIVE AND INERT. Every column here is nullable, or NOT NULL with a
-- default that describes every existing row correctly. Nothing reads any of it
-- until the code in wave A ships, so this migration can land ahead of that code
-- and the app behaves exactly as it does today.
--
-- ONE DELIBERATE DEVIATION FROM THE SPEC. The design converts
-- `notifications.type` from its two-value pgEnum to text, so that "a new kind
-- is a string at a call site rather than a migration". The new `kind` column
-- below already delivers exactly that, and `type` becomes the legacy fallback
-- the design itself describes ("title/body become fallback"). Converting a
-- live column on a database three sessions share, for a benefit already
-- obtained, is risk with nothing bought. `type` is left alone.

-- 1. tasks.completed_at, alone and first, because four dependents unblock on
--    it. NULL for every existing row and that is honest: nothing recorded when
--    those tasks were finished, and backfilling from updated_at would invent a
--    completion time indistinguishable from a real one ever after. The
--    activity_log 'completed' verb remains the historical answer.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;--> statement-breakpoint

-- 2. "What is on this person's plate, soonest first" — the read behind every
--    deadline surface, and it had no index. Partial on the two conditions
--    every one of those reads already carries.
CREATE INDEX IF NOT EXISTS "tasks_assignee_due_idx" ON "tasks" USING btree ("assignee_id","due_date") WHERE "tasks"."deleted_at" is null AND "tasks"."status" <> 'done';--> statement-breakpoint

-- 3. apps.internal. false is right for every existing row: a project nobody
--    marked internal is a client project, which is what they all are today.
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- 4. The notification substrate. `kind` defaults to 'legacy' so the column is
--    NOT NULL from the first instant, then is backfilled from the existing
--    enum below — two steps rather than one, because a NOT NULL column with no
--    default cannot be added to a table that already has rows.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title_key" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "params" jsonb;--> statement-breakpoint
-- No foreign key on either, matching activity_log's posture and for its reason:
-- a notification about a task must SURVIVE that task being trashed. The
-- click-through resolves at read time and degrades to "no longer available"
-- rather than the row vanishing out from under somebody's inbox.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entity_type" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entity_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_permanent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "collapse_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- NOT `deleted_at`. This table is not part of the five-table soft-delete
-- contract and must not be pulled into it by naming: dismissing a notification
-- is the reader clearing their own inbox, not an admin trashing a record, and
-- there is no Trash bin that should ever list one.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "digest_state" text DEFAULT 'none' NOT NULL;--> statement-breakpoint

-- Backfill `kind` from the enum it supersedes, so no row is left describing
-- itself as 'legacy' when it knows better. Idempotent: only the rows still
-- holding the default are touched.
UPDATE "notifications" SET "kind" = "type"::text WHERE "kind" = 'legacy';--> statement-breakpoint

-- 5. Five indexes on a table that had none, while the bell polls it every 20s.
CREATE INDEX IF NOT EXISTS "notifications_bell_idx" ON "notifications" USING btree ("user_id","read","created_at" DESC) WHERE "notifications"."dismissed_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_inbox_idx" ON "notifications" USING btree ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_entity_idx" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint

-- The two dedupe indexes, each its own statement because each can fail on its
-- own. Safe here in a way they will not be later: `dedupe_key` is brand new and
-- NULL on every existing row, and NULLs do not collide in a unique index.
--
-- PERMANENT is the escalation ladder: one row per (person, key), ever.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_permanent_idx" ON "notifications" USING btree ("user_id","dedupe_key") WHERE "notifications"."dedupe_permanent";--> statement-breakpoint
-- COLLAPSING is comments and mentions: one row per (person, key) only while it
-- is still unread and undismissed, so the count resets once they have seen it
-- rather than collapsing forever into a notification they already read.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_collapse_idx" ON "notifications" USING btree ("user_id","dedupe_key") WHERE NOT "notifications"."dedupe_permanent" AND "notifications"."read" = false AND "notifications"."dismissed_at" is null;
