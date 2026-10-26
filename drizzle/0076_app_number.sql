-- Automatic project number (#1, #2, ...), assigned on create; never typed,
-- never edited, never reused. Replaces 0075's typed text column, which was
-- applied to dev but never held data (0 of 39 rows) and never shipped in code.
--
-- Existing projects are numbered oldest first (created_at, then id for ties).
-- The sequence is named the way a serial column's is, so schema.ts declares
-- it as serial and the generated default matches.
DROP INDEX IF EXISTS "apps_live_project_number_idx";
--> statement-breakpoint
ALTER TABLE "apps" DROP COLUMN IF EXISTS "project_number";
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "number" integer;
--> statement-breakpoint
WITH "ordered" AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS "rn" FROM "apps"
)
UPDATE "apps" SET "number" = "ordered"."rn" FROM "ordered" WHERE "apps"."id" = "ordered"."id" AND "apps"."number" IS NULL;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "apps_number_seq" OWNED BY "apps"."number";
--> statement-breakpoint
SELECT setval('apps_number_seq', COALESCE((SELECT max("number") FROM "apps"), 0) + 1, false);
--> statement-breakpoint
ALTER TABLE "apps" ALTER COLUMN "number" SET DEFAULT nextval('apps_number_seq');
--> statement-breakpoint
ALTER TABLE "apps" ALTER COLUMN "number" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "apps_number_idx" ON "apps" ("number");
