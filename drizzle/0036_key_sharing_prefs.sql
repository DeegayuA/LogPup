ALTER TABLE "gemini_keys" ADD COLUMN IF NOT EXISTS "shared" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "gemini_keys" ADD COLUMN IF NOT EXISTS "tier" text NOT NULL DEFAULT 'free';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_ai_prefs" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"feature" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp NOT NULL DEFAULT now(),
	CONSTRAINT "user_ai_prefs_pk" PRIMARY KEY ("user_id","feature")
);
