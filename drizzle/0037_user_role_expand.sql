-- Widen user_role from admin|member to the seven-seat ladder.
--
-- SHIPS ALONE, ON PURPOSE. Postgres refuses to use a new enum value in the
-- same transaction that added it, so the backfill that remaps existing admins
-- to superadmin is 0039, two files later. Putting them in one file produces
-- "unsafe use of new value of enum type" at apply time.
--
-- No DO $$ guard here, unlike every other migration in this folder: ALTER TYPE
-- ... ADD VALUE is not permitted inside a function or transaction block on all
-- paths, so the usual EXCEPTION WHEN duplicate_object idiom cannot wrap it.
-- ADD VALUE IF NOT EXISTS gives the same replay safety on its own.
--
-- Additive only. Nobody's access changes when this applies: 'admin' and
-- 'member' keep meaning exactly what they meant. The remap is 0039 and the
-- capability behaviour behind the new names ships with the application code.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'superadmin';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'manager';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'editor';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'stakeholder';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'auditor';
