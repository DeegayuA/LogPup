CREATE TABLE "meeting_screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"captured_at_ms" integer NOT NULL,
	"width" integer,
	"height" integer,
	"byte_size" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_screenshots" ADD CONSTRAINT "meeting_screenshots_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_screenshots" ADD CONSTRAINT "meeting_screenshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_screenshots_meeting_captured_idx" ON "meeting_screenshots" USING btree ("meeting_id","captured_at_ms");