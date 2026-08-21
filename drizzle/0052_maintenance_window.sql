-- Planned maintenance: one row that says whether the workspace is open.
--
-- SINGLETON BY CONSTRAINT, not by convention. The primary key is text and the
-- CHECK pins it to 'current', so "which window is in force" can never be an
-- ambiguity resolved by an ORDER BY somebody forgot to write.
--
-- Milliseconds rather than timestamps: every reader of these numbers is
-- counting down to them in a browser, and the conversion is exactly where a
-- window would end up five and a half hours away from the one that was
-- announced. src/features/maintenance/window.ts owns every reading of them.
--
-- mode and kind are text with no enum. The parser treats an unrecognised value
-- as "no maintenance", which is the fail-open rule the feature rests on; a
-- database enum would turn that safe read into a hard write failure.
--
-- Additive and inert. No row exists until an admin arms one, and until then
-- every read of this table answers "no maintenance" — which is byte-for-byte
-- how the app behaved the day before this applied.
CREATE TABLE IF NOT EXISTS "maintenance_window" (
	"id" text PRIMARY KEY DEFAULT 'current' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"start_at_ms" bigint NOT NULL,
	"end_at_ms" bigint NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"mode" text NOT NULL,
	"kind" text NOT NULL,
	"created_by" uuid,
	"created_by_name" text DEFAULT 'an admin' NOT NULL,
	"start_notified_at_ms" bigint,
	"end_notified_at_ms" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "maintenance_window" ADD CONSTRAINT "maintenance_window_singleton_check" CHECK ("id" = 'current');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "maintenance_window" ADD CONSTRAINT "maintenance_window_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
