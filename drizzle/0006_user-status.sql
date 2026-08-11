CREATE TYPE "public"."user_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
-- Backfill: every row that existed before open self-signup shipped was
-- already vetted (admin-created, invited, or an existing allowed-domain
-- login) — default them to 'approved' so this migration cannot lock out
-- current users (including admins) the moment it lands. Only a NEW row
-- inserted after this point (self-signup via Google, see src/lib/auth.ts)
-- should ever start life as 'pending'.
UPDATE "users" SET "status" = 'approved';