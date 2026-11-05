-- Module B, phases B2–B4: refinement, review, retro, standup, ceremonies.
--
-- B2 refinement. A story is "ready" when a person says so (ready_at/by); the
-- Definition of Ready checklist is computed from the item itself, except the
-- one box nothing else can tick: product approval (product_approved_at/by).
-- risk is a three-step scale, null = not assessed.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "ready_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "ready_by" uuid REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "product_approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "product_approved_by" uuid REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "risk" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_risk_level" CHECK ((risk IS NULL) OR (risk = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- B3 sprint review: stakeholder feedback, optionally pinned to a work item.
CREATE TABLE IF NOT EXISTS "sprint_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sprint_id" uuid NOT NULL REFERENCES "sprints"("id") ON DELETE CASCADE,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sprint_feedback_sprint_idx" ON "sprint_feedback" ("sprint_id", "created_at");
--> statement-breakpoint

-- B3 retrospective: went well / to improve / action. An action can be turned
-- into a task (task_id) and closed (done_at).
CREATE TABLE IF NOT EXISTS "retro_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sprint_id" uuid NOT NULL REFERENCES "sprints"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "body" text NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "owner_id" uuid REFERENCES "users"("id"),
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL,
  "done_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "retro_items_kind" CHECK (kind = ANY (ARRAY['went_well'::text, 'improve'::text, 'action'::text]))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retro_items_sprint_idx" ON "retro_items" ("sprint_id", "created_at");
--> statement-breakpoint

-- B4 daily standup: one entry per person per sprint per day, kept as history
-- (sprint_checkins holds only the latest percentage and is overwritten).
CREATE TABLE IF NOT EXISTS "standup_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sprint_id" uuid NOT NULL REFERENCES "sprints"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "day" date NOT NULL,
  "yesterday" text,
  "today" text,
  "blockers" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "standup_entries_one_per_day_idx" ON "standup_entries" ("sprint_id", "user_id", "day");
--> statement-breakpoint

-- B4 ceremonies: a meeting can say which Scrum ceremony it is, for which sprint.
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "ceremony" text;
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "sprint_id" uuid REFERENCES "sprints"("id") ON DELETE SET NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "meetings" ADD CONSTRAINT "meetings_ceremony_kind" CHECK ((ceremony IS NULL) OR (ceremony = ANY (ARRAY['planning'::text, 'standup'::text, 'refinement'::text, 'review'::text, 'retro'::text])));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_sprint_idx" ON "meetings" ("sprint_id") WHERE "sprint_id" IS NOT NULL;
