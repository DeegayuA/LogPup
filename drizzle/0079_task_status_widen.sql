-- PRD Module A workflow: To do -> In progress -> Code review -> Ready for QA
-- -> QA -> Ready for release -> Released -> Done, plus Blocked, QA failed,
-- Rework required and Deferred. ("Reopened" is an event, not a state: a move
-- from a finished status back to an open one, logged with verb 'reopened'.)
--
-- ADD VALUE ONLY, in a file of its own, and nothing in this file uses the new
-- values: Postgres refuses a new enum value inside the transaction that added
-- it. No code may read or write these values until this is applied and the
-- labels are confirmed in pg_enum — schema.ts declares them only after that.
--
-- Placed after 'in_progress' and before 'done' so asc(status) keeps meaning
-- "unfinished first" for every reader that already sorts by it.

ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'in_review' BEFORE 'done';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'ready_for_qa' BEFORE 'done';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'qa' BEFORE 'done';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'qa_failed' BEFORE 'done';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'rework' BEFORE 'done';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'ready_for_release' BEFORE 'done';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'released' BEFORE 'done';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'blocked' BEFORE 'done';
--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'deferred' BEFORE 'done';
