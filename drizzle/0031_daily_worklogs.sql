CREATE TABLE IF NOT EXISTS "daily_worklogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"percent" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "daily_worklogs" ADD CONSTRAINT "daily_worklogs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_worklogs_user_day_idx" ON "daily_worklogs" ("user_id","day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_worklogs_day_idx" ON "daily_worklogs" ("day");
