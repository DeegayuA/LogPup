-- One meeting, several projects.
--
-- meeting_apps is a plain many-to-many between meetings and apps. Every
-- project on a meeting is EQUAL: there is no is_primary, no sort_order and no
-- created_at. Display order is ORDER BY apps.name at every read site, so the
-- list cannot repaint when a project is added, and there is nothing here for a
-- "primary project" to hide in. Same two-column shape, and the same composite
-- primary key, as meeting_attendees.
--
-- No deleted_at. This table has no content to retract: unlinking a project
-- loses nothing the same control cannot put back in one click, and the change
-- is already in activity_log. It is a meeting CHILD table in the sense
-- src/db/live.ts documents -- live iff its meeting is live -- so trashing a
-- meeting leaves these rows untouched and restoreMeeting brings the meeting
-- back with its projects still attached. Registered in MEETING_CHILD_TABLES
-- in the same change.
--
-- meetings.app_id is NOT dropped here and is NOT dropped later by this work.
-- It stays as a deprecated single-value mirror because change_requests.app_id
-- routing needs one stable answer without resolving a set. See the comment on
-- the column in src/db/schema.ts.
--
-- Replay-safe throughout, same discipline as 0029/0038: every statement must
-- survive running again against a database where it already ran, and every
-- statement must be applyable ON ITS OWN. npm run db:migrate wraps each file
-- in a transaction and 0037's ALTER TYPE could not be applied through it at
-- all (exit 1, no message), so nothing here may depend on the runner.
CREATE TABLE IF NOT EXISTS "meeting_apps" (
	"meeting_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	CONSTRAINT "meeting_apps_meeting_id_app_id_pk" PRIMARY KEY("meeting_id","app_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_apps" ADD CONSTRAINT "meeting_apps_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_apps" ADD CONSTRAINT "meeting_apps_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- The reverse direction: "which meetings is this project on" -- getMeetingsForApp,
-- listApps' meeting counts, getAppCounts, getAppActivity and the sprint-goal
-- draft all lead with app_id. The composite primary key above only serves the
-- meeting_id direction. It is also the index the app_id foreign key's cascade
-- delete uses; tasks learned that lesson the expensive way.
CREATE INDEX IF NOT EXISTS "meeting_apps_app_idx" ON "meeting_apps" USING btree ("app_id");
--> statement-breakpoint
-- BACKFILL. Deliberately NOT filtered by deleted_at IS NULL: a trashed meeting
-- must restore with its project intact, and the admin Trash card names the
-- project on a trashed meeting. ON CONFLICT DO NOTHING makes the statement a
-- no-op on a second run rather than a 23505 -- this repo hand-applies SQL and
-- has re-run statements before. No referential repair is needed: meetings.app_id
-- already REFERENCES apps(id) ON DELETE SET NULL, so every non-null value points
-- at a live app.
INSERT INTO "meeting_apps" ("meeting_id", "app_id")
SELECT "id", "app_id" FROM "meetings" WHERE "app_id" IS NOT NULL
ON CONFLICT DO NOTHING;
