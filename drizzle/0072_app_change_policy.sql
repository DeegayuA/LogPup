-- Per-project change policy: 'auto_save' describes every existing row (today every
-- permitted write lands immediately); 'lead_approval' routes app.edit/app.archive
-- by a scoped seat through change_requests for the app's lead to sign.
--
-- An ENUM (not boolean) follows appStatus/changeRequestStatus so a third mode costs
-- a value, not a rename.
CREATE TYPE "public"."app_change_policy" AS ENUM('auto_save', 'lead_approval');
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "change_policy" "app_change_policy" DEFAULT 'auto_save' NOT NULL;
