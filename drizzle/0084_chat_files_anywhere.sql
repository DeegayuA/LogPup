-- Module D: files in DMs and group chats.
--
-- attachments.app_id was NOT NULL because every attachment hung off project
-- work (task, bug, doc). A DM or group conversation has no project, so a file
-- shared there has no app to name. app_id becomes optional for chat messages
-- ONLY; every other owner type still has to name its project, so nothing that
-- reads task/bug/doc attachments by app can meet a NULL.
ALTER TABLE "attachments" ALTER COLUMN "app_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_app_unless_message" CHECK ((owner_type = 'message'::text) OR (app_id IS NOT NULL));
