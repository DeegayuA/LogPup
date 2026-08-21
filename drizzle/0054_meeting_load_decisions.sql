-- Decisions about meeting-load suggestions. The engine's only table.
--
-- OPEN SUGGESTIONS ARE NOT STORED, and that is the whole design. Every
-- suggestion is an assertion about live work ("these four items need the same
-- five people"). The moment one is written down it starts rotting: the
-- follow-up is answered, the task is ticked, the deadline moves, and the row
-- on screen keeps insisting otherwise. So suggestions are computed live on
-- every render and only DECISIONS persist — which is also why there is no
-- cron, no generator, and no write during a page render.
--
-- kind is text, not a pgEnum, per the activityLog precedent: R1-R5 arrive
-- after R6 and each would otherwise cost a migration, and ALTER TYPE ... ADD
-- VALUE cannot be used in the same transaction that added it (see 0037, 0053).
--
-- status REUSES suggestion_status rather than minting an enum. Rows only ever
-- hold 'accepted' or 'dismissed'; 'open' is what it means for no row to exist,
-- and storing it would create a second, contradictable answer to "is this
-- still open".
--
-- evidence is a snapshot of the numbers that were on screen when somebody
-- decided. Not for re-deriving the suggestion — it holds ids, never names, so
-- a dismissed group cannot become a place where somebody's name is kept after
-- they are gone.
--
-- The UNIQUE INDEX on (kind, target_key) IS the never-re-show guarantee: the
-- renderer filters live suggestions against the decided keys, and the index is
-- what stops two clicks racing into two rows that half-suppress it. Admin
-- Reopen deletes the row, which is the only path back.
--
-- decided_by is ON DELETE SET NULL, not cascade: removing an account should
-- not silently un-dismiss every suggestion that account ever dismissed.
--
-- Additive and inert. Nothing reads this table until /meetings/load renders,
-- and with no rows every suggestion is simply open — byte-for-byte how the app
-- behaved the day before this applied.
CREATE TABLE IF NOT EXISTS "meeting_load_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"target_key" text NOT NULL,
	"status" "suggestion_status" NOT NULL,
	"evidence" jsonb NOT NULL,
	"decided_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "meeting_load_decisions" ADD CONSTRAINT "meeting_load_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_load_decisions_kind_target_idx" ON "meeting_load_decisions" USING btree ("kind","target_key");
