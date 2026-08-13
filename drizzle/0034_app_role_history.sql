-- Append-only "as of" index of who has held PM or lead on an app, and when.
--
-- Exactly the assignment_history pattern (src/db/schema.ts) applied to
-- apps.pm_id / apps.lead_id — read that comment first; this file only notes
-- where the two differ. apps.pm_id / apps.lead_id stay THE live state,
-- untouched: every existing read path keeps working with no new filter to
-- remember. Without this table, updateApp overwrote pm_id/lead_id IN PLACE
-- and every prior holder was lost — only an activity_log row said a change
-- had happened, which cannot answer "who was PM on 12 June" from one indexed
-- query.
--
-- Replay-safe throughout, same discipline as 0019/0021-0033: every statement
-- must survive running again against a database where it already ran. DDL is
-- guarded with IF NOT EXISTS / duplicate_object handlers in the style 0029
-- established; the backfill INSERT below is idempotent by construction — its
-- WHERE clause stops matching once it has been applied.
DO $$ BEGIN
	CREATE TYPE "public"."app_role_kind" AS ENUM('pm', 'lead');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_role_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app_role_kind" NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"changed_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "app_role_history" ADD CONSTRAINT "app_role_history_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "app_role_history" ADD CONSTRAINT "app_role_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "app_role_history" ADD CONSTRAINT "app_role_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- Per-app timeline: "who has been PM/lead of this app, and when".
CREATE INDEX IF NOT EXISTS "app_role_history_app_from_idx" ON "app_role_history" USING btree ("app_id","effective_from");
--> statement-breakpoint
-- Per-person view: "which apps has this person been PM/lead of, and when".
CREATE INDEX IF NOT EXISTS "app_role_history_user_from_idx" ON "app_role_history" USING btree ("user_id","effective_from");
--> statement-breakpoint
-- "As of" lookups filter on the interval bounds alone, same shape as
-- assignment_history_as_of_idx.
CREATE INDEX IF NOT EXISTS "app_role_history_as_of_idx" ON "app_role_history" USING btree ("effective_from","effective_to");
--> statement-breakpoint
-- THE INVARIANT: at most one open row per (app_id, role). Narrower than
-- assignment_history's (user_id, app_id) key, because a role here is a single
-- scalar column on `apps` — there is one pm and at most one lead at a time,
-- not a set of allocations. Enforced, not just documented, the same way
-- assignment_history_one_open_idx and meeting_attendee_history_one_open_idx
-- are: a second open interval for the same (app, role) would make an "as of"
-- read ambiguous about who held it.
CREATE UNIQUE INDEX IF NOT EXISTS "app_role_history_one_open_idx" ON "app_role_history" USING btree ("app_id","role") WHERE "app_role_history"."effective_to" is null;
--> statement-breakpoint

-- BACKFILL: one open row per app for its current pm_id, and one for lead_id
-- where non-null, so the history surfaces are not empty on day one.
--
-- effective_from = apps.created_at: the earliest instant this app is known to
-- have existed, cast from the naive `timestamp` column to `timestamptz` via
-- AT TIME ZONE 'UTC' (every writer stores UTC — same conversion the 0015 and
-- 0029 backfills use).
--
-- changed_by is inferred, in order: the oldest admin, else the app's own PM
-- (guaranteed non-null, unlike lead_id) — there is no real actor to name for
-- a change nobody made through the app.
--
-- CRITICAL — these rows are NOT observed history, they are an assumption
-- made at migration time about a state that already existed. note is set to
-- the FIXED SENTINEL 'backfilled at migration' (BACKFILLED_APP_ROLE_NOTE in
-- src/features/apps/role-history.ts) — a short, exact-match string rather
-- than a prose description — precisely so a consumer can tell "we watched
-- this happen" from "we assumed this at migration time" with a plain
-- equality check. This project has been burned by the alternative once
-- already: migration 0015 backfilled assignment_history with an inferred
-- effective_from indistinguishable from an observed one, and a whole planned
-- feature had to drop as-of allocation as untrustworthy as a result. Do not
-- weaken this sentinel or make it row-specific — every reader that treats
-- "backfilled" as a fact depends on it being this one fixed string.
--
-- NOT EXISTS guards: this file must be safe to replay, and they are also what
-- keeps this compatible with the one-open unique index above.
INSERT INTO "app_role_history"
  ("app_id", "user_id", "role", "effective_from", "effective_to", "changed_by", "note")
SELECT
  a."id",
  a."pm_id",
  'pm',
  a."created_at" AT TIME ZONE 'UTC',
  NULL,
  COALESCE(
    (SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1),
    a."pm_id"
  ),
  'backfilled at migration'
FROM "apps" a
WHERE NOT EXISTS (
  SELECT 1 FROM "app_role_history" h
  WHERE h."app_id" = a."id" AND h."role" = 'pm'
);
--> statement-breakpoint
INSERT INTO "app_role_history"
  ("app_id", "user_id", "role", "effective_from", "effective_to", "changed_by", "note")
SELECT
  a."id",
  a."lead_id",
  'lead',
  a."created_at" AT TIME ZONE 'UTC',
  NULL,
  COALESCE(
    (SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1),
    a."pm_id"
  ),
  'backfilled at migration'
FROM "apps" a
WHERE a."lead_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "app_role_history" h
    WHERE h."app_id" = a."id" AND h."role" = 'lead'
  );
