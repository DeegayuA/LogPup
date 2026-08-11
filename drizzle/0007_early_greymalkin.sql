CREATE TYPE "public"."followup_kind" AS ENUM('question', 'action');--> statement-breakpoint
CREATE TYPE "public"."followup_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "meeting_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_meeting_id" uuid NOT NULL,
	"user_id" uuid,
	"person_name" text NOT NULL,
	"text" text NOT NULL,
	"kind" "followup_kind" NOT NULL,
	"status" "followup_status" DEFAULT 'open' NOT NULL,
	"resolved_in_meeting_id" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_followups" ADD CONSTRAINT "meeting_followups_source_meeting_id_meetings_id_fk" FOREIGN KEY ("source_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_followups" ADD CONSTRAINT "meeting_followups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_followups" ADD CONSTRAINT "meeting_followups_resolved_in_meeting_id_meetings_id_fk" FOREIGN KEY ("resolved_in_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;