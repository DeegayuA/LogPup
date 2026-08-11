CREATE TYPE "public"."attendee_response" AS ENUM('pending', 'going', 'maybe', 'declined');--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD COLUMN "response" "attendee_response" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "meeting_url" text;