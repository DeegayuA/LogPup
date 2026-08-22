-- Mentions: who was named, where, and whether it reached them.
--
-- Design: docs/superpowers/specs/2026-08-20-reaching-people-design.md
--
-- ADDITIVE AND INERT. One new table, read by nothing until the extraction call
-- sites ship. No existing reader changes behaviour.
CREATE TABLE IF NOT EXISTS "mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	-- app_comment | note_segment | meeting_notes | task | worklog | followup.
	-- Drawn from MENTION_SOURCES in features/notifications/entity-kinds.ts, so
	-- this column and activity_log.entity_type cannot drift into two
	-- vocabularies that no longer join.
	"source_type" text NOT NULL,
	-- NO FOREIGN KEY, matching activity_log.entity_id's posture deliberately. A
	-- mention is EVIDENCE that must outlive a trashed or purged source: "you
	-- told me in that comment" stays true after the comment is gone.
	"source_id" uuid NOT NULL,
	-- Denormalised so an orphaned row is still readable as a sentence. Without
	-- it, a mention whose source was purged renders as a link to nothing.
	"source_label" text NOT NULL,
	"mentioned_user_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	-- Denormalised for scoped reads, and nullable: a worklog mention belongs to
	-- no project, and forcing one would attribute it to a wrong project.
	"app_id" uuid,
	-- Whether a bell row was actually created. False is the interesting case.
	"notified" boolean DEFAULT false NOT NULL,
	-- no_access | inactive | self | assignment_supersedes. NULL when it was
	-- delivered. The row is written EITHER WAY: a mention that could not be
	-- delivered is recorded and reported, never dropped, because without that
	-- half the org spends six months believing they told somebody.
	"suppressed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Neither user reference carries an onDelete rule, matching activity_log.actor_id.
-- Users here are deactivated, never deleted; a cascade is a rule that could only
-- ever fire by accident.
DO $$ BEGIN
	ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "mentions" ADD CONSTRAINT "mentions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- THE ANTI-SPAM MECHANISM, and the reason this table exists at all.
--
-- It lives at the storage layer specifically so the several call sites that
-- extract mentions cannot each get it wrong. Re-running extraction over an
-- edited body inserts nothing: editing yesterday's worklog note four times
-- writes one row and sends one notification. A mention notifies EXACTLY ONCE,
-- EVER.
--
-- This is a DIFFERENT guarantee from the collapsing dedupe index on
-- notifications, and both are needed. That one resets once the reader catches
-- up, by design. Under it alone, editing a body after somebody read the mention
-- would notify them again. Under this one alone, three genuinely different
-- mentions would be three bell rows. Do not "simplify" either away.
CREATE UNIQUE INDEX IF NOT EXISTS "mentions_source_user_idx" ON "mentions" USING btree ("source_type","source_id","mentioned_user_id");--> statement-breakpoint
-- "Mentions of me", newest first.
CREATE INDEX IF NOT EXISTS "mentions_of_me_idx" ON "mentions" USING btree ("mentioned_user_id","created_at" DESC);
