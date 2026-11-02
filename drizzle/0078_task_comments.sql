-- Comments on a task (PRD Module A "Comments"). A first-person discussion
-- attached to the work item, distinct from app_comments (one thread per
-- project).
--
-- ADOPTS A TABLE THAT ALREADY EXISTS ON THE SHARED DEV DATABASE, the same way
-- 0077 adopted the rest of the Module A schema: it was applied there with no
-- file in this repo. Reproduced exactly from the catalogs and idempotent, so
-- on dev it changes nothing and elsewhere it creates the same shape.
--
-- Soft-deleted (deleted_at/deleted_by): a removed comment leaves the thread
-- readable and the trash restorable, the rule every soft table here follows.

CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "edited_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_comments_task_idx" ON "task_comments" ("task_id", "created_at");
