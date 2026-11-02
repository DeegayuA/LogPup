-- PRD Module A work-item foundation: task types and hierarchy, per-project task
-- numbers ("LOG-245"), story points, labels, components, acceptance criteria,
-- links between work items, and attachments.
--
-- ADOPTS SCHEMA THAT ALREADY EXISTS ON THE SHARED DEV DATABASE. These objects
-- were applied there on 2026-10-27 by a migration whose file never reached this
-- repo (ledger row 82, created_at 1793059200000). This file reproduces them
-- exactly, read back from the catalogs, and every statement is idempotent, so
-- on dev it records the change without altering anything and on any other
-- database it creates the same shape. Its `when` is above that ledger row, or
-- the migrator would skip it (see the dev-db-ledger-ahead-of-tree note).
--
-- Task numbers are assigned by a trigger, not app code: neon-http has no
-- interactive transactions, so read-then-insert from the app would race.

DO $$ BEGIN
  CREATE TYPE "public"."task_type" AS ENUM('epic', 'feature', 'story', 'task', 'subtask', 'bug', 'improvement', 'tech_debt', 'spike');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "key" text;
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "next_task_number" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "apps" ADD CONSTRAINT "apps_key_format" CHECK ((key IS NULL) OR ((key ~ '^[A-Z][A-Z0-9]{1,5}$') AND (key !~ '^P[0-9]+$')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "apps_key_idx" ON "apps" ("key") WHERE "key" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "number" integer;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "type" "task_type" DEFAULT 'task' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "parent_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "reporter_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "story_points" numeric(5, 1);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "start_date" date;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "environment" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_story_points_nonneg" CHECK ((story_points IS NULL) OR (story_points >= (0)::numeric));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_not_self" CHECK ((parent_id IS NULL) OR (parent_id <> id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
WITH "ordered" AS (
  SELECT "id", row_number() OVER (PARTITION BY "app_id" ORDER BY "created_at", "id") AS "rn"
  FROM "tasks" WHERE "number" IS NULL
)
UPDATE "tasks" SET "number" = "ordered"."rn" + COALESCE((SELECT max(t2."number") FROM "tasks" t2 WHERE t2."app_id" = "tasks"."app_id"), 0)
FROM "ordered" WHERE "tasks"."id" = "ordered"."id";
--> statement-breakpoint
UPDATE "apps" SET "next_task_number" = GREATEST("next_task_number", COALESCE((SELECT max("number") FROM "tasks" WHERE "tasks"."app_id" = "apps"."id"), 0) + 1);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_app_number_idx" ON "tasks" ("app_id", "number") WHERE "number" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_parent_idx" ON "tasks" ("parent_id") WHERE "parent_id" IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."assign_task_number"() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW."number" IS NULL OR (TG_OP = 'UPDATE' AND NEW."app_id" IS DISTINCT FROM OLD."app_id") THEN
    UPDATE "apps" SET "next_task_number" = "next_task_number" + 1
      WHERE "id" = NEW."app_id"
      RETURNING "next_task_number" - 1 INTO NEW."number";
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE "apps" SET "next_task_number" = GREATEST("next_task_number", NEW."number" + 1)
      WHERE "id" = NEW."app_id";
  END IF;
  RETURN NEW;
END;
$function$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "tasks_assign_number" ON "tasks";
--> statement-breakpoint
CREATE TRIGGER "tasks_assign_number" BEFORE INSERT OR UPDATE OF "app_id" ON "tasks" FOR EACH ROW EXECUTE FUNCTION "public"."assign_task_number"();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "lead_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_components_app_name_idx" ON "app_components" ("app_id", lower("name"));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_components" (
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "component_id" uuid NOT NULL REFERENCES "app_components"("id") ON DELETE CASCADE,
  CONSTRAINT "task_components_pkey" PRIMARY KEY ("task_id", "component_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_components_component_idx" ON "task_components" ("component_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_labels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "color_slot" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_labels_app_name_idx" ON "task_labels" ("app_id", lower("name"));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_label_links" (
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "label_id" uuid NOT NULL REFERENCES "task_labels"("id") ON DELETE CASCADE,
  CONSTRAINT "task_label_links_pkey" PRIMARY KEY ("task_id", "label_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_label_links_label_idx" ON "task_label_links" ("label_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "acceptance_criteria" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "sort_order" double precision DEFAULT 0 NOT NULL,
  "qa_verdict" text,
  "verified_by" uuid REFERENCES "users"("id"),
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "acceptance_criteria_verdict" CHECK ((qa_verdict IS NULL) OR (qa_verdict = ANY (ARRAY['pass'::text, 'fail'::text])))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "acceptance_criteria_task_idx" ON "acceptance_criteria" ("task_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
  "from_type" text NOT NULL,
  "from_id" uuid NOT NULL,
  "to_type" text NOT NULL,
  "to_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_links_types" CHECK ((from_type = ANY (ARRAY['task'::text, 'bug'::text, 'doc'::text, 'meeting'::text])) AND (to_type = ANY (ARRAY['task'::text, 'bug'::text, 'doc'::text, 'meeting'::text]))),
  CONSTRAINT "work_links_kind" CHECK (kind = ANY (ARRAY['blocks'::text, 'relates'::text, 'duplicates'::text, 'fixes'::text, 'implements'::text, 'documents'::text])),
  CONSTRAINT "work_links_not_self" CHECK (NOT ((from_type = to_type) AND (from_id = to_id)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "work_links_edge_idx" ON "work_links" ("from_type", "from_id", "to_type", "to_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_links_to_idx" ON "work_links" ("to_type", "to_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_links_app_idx" ON "work_links" ("app_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
  "owner_type" text NOT NULL,
  "owner_id" uuid NOT NULL,
  "blob_path" text NOT NULL,
  "name" text NOT NULL,
  "mime" text NOT NULL,
  "bytes" integer NOT NULL,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid REFERENCES "users"("id"),
  CONSTRAINT "attachments_owner_type" CHECK (owner_type = ANY (ARRAY['task'::text, 'bug'::text, 'doc'::text, 'message'::text])),
  CONSTRAINT "attachments_bytes" CHECK (bytes >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_owner_idx" ON "attachments" ("owner_type", "owner_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_app_idx" ON "attachments" ("app_id");
