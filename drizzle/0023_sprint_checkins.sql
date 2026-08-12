-- IF NOT EXISTS / guarded throughout — same reason as 0019, 0021 and 0022:
-- drizzle's bookkeeping on this database only records 0000/0001, so this file
-- must be safe to run against a database where it was already applied by hand.
-- This file originally shipped unguarded, unlike its neighbours; a replay would
-- have failed on the CREATE TABLE and taken the rest of the chain with it.
CREATE TABLE IF NOT EXISTS "sprint_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"percent" integer NOT NULL,
	"note" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "sprint_checkins" ADD CONSTRAINT "sprint_checkins_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "sprint_checkins" ADD CONSTRAINT "sprint_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sprint_checkins_sprint_user_idx" ON "sprint_checkins" USING btree ("sprint_id","user_id");
