CREATE TABLE "gemini_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"last4" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_ai_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"transcript" text,
	"summary" text,
	"per_person" jsonb,
	"deadlines" jsonb,
	"terms" jsonb,
	"questions" jsonb,
	"model" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_ai_notes_meeting_id_unique" UNIQUE("meeting_id")
);
--> statement-breakpoint
ALTER TABLE "gemini_keys" ADD CONSTRAINT "gemini_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_ai_notes" ADD CONSTRAINT "meeting_ai_notes_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_ai_notes" ADD CONSTRAINT "meeting_ai_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;