ALTER TABLE "meeting_followups" ADD COLUMN "response_note" text;--> statement-breakpoint
ALTER TABLE "meeting_followups" ADD COLUMN "defer_reason" text;--> statement-breakpoint
ALTER TABLE "meeting_followups" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "meeting_followups" ADD COLUMN "target_meeting_id" uuid;--> statement-breakpoint
ALTER TABLE "meeting_followups" ADD CONSTRAINT "meeting_followups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_followups" ADD CONSTRAINT "meeting_followups_target_meeting_id_meetings_id_fk" FOREIGN KEY ("target_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;
