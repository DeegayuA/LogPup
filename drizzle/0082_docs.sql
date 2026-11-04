-- Module C: Documentation & Knowledge Hub.
--
-- docs: one living page per row, Markdown body, soft-deleted like tasks
-- (a lost architecture page must be restorable from Trash).
-- doc_revisions: every save that changes the page writes the NEW state as
-- revision N (version = docs.version after the save), with author, time and
-- an optional change summary. History, compare and restore all read here;
-- restore writes a fresh revision rather than rewinding, so nothing is lost.
-- doc_comments: discussion under a page; the author may delete their own.
CREATE TABLE IF NOT EXISTS "docs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "category" text DEFAULT 'project' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "updated_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid REFERENCES "users"("id"),
  CONSTRAINT "docs_category" CHECK (category = ANY (ARRAY['project'::text, 'requirements'::text, 'architecture'::text, 'api'::text, 'database'::text, 'setup'::text, 'deployment'::text, 'qa'::text, 'runbook'::text, 'meeting_notes'::text, 'release_notes'::text, 'other'::text])),
  CONSTRAINT "docs_version_positive" CHECK (version >= 1)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "docs_app_idx" ON "docs" ("app_id", "category", "updated_at") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doc_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "doc_id" uuid NOT NULL REFERENCES "docs"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "summary" text,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "doc_revisions_doc_version_idx" ON "doc_revisions" ("doc_id", "version");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doc_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "doc_id" uuid NOT NULL REFERENCES "docs"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_comments_doc_idx" ON "doc_comments" ("doc_id", "created_at");
