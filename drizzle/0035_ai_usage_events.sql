CREATE TABLE IF NOT EXISTS "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"key_id" uuid REFERENCES "gemini_keys"("id") ON DELETE SET NULL,
	"key_owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"key_last4" text,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL DEFAULT 0,
	"output_tokens" integer NOT NULL DEFAULT 0,
	"status" text NOT NULL DEFAULT 'ok',
	"created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_user_created_idx" ON "ai_usage_events" ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_key_owner_created_idx" ON "ai_usage_events" ("key_owner_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_feature_created_idx" ON "ai_usage_events" ("feature","created_at");
