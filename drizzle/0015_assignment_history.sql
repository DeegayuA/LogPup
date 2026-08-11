CREATE TYPE "public"."allocation_change" AS ENUM('assigned', 'updated', 'removed');--> statement-breakpoint
CREATE TABLE "assignment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"role" text NOT NULL,
	"allocation_pct" integer NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"changed_by" uuid NOT NULL,
	"change_kind" "allocation_change" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_history_user_from_idx" ON "assignment_history" USING btree ("user_id","effective_from");--> statement-breakpoint
CREATE INDEX "assignment_history_app_from_idx" ON "assignment_history" USING btree ("app_id","effective_from");--> statement-breakpoint
CREATE INDEX "assignment_history_as_of_idx" ON "assignment_history" USING btree ("effective_from","effective_to");
--> statement-breakpoint
-- BACKFILL: one open history row per existing assignment, so the history
-- surfaces are not empty on day one.
--
-- effective_from = GREATEST(person.created_at, app.created_at): an assignment
-- cannot have existed before BOTH the person and the app did, so this is the
-- earliest instant the pairing was even possible. Taking the app's date alone
-- would date a new hire's assignment to before they joined; taking the user's
-- alone would date it to before the app existed. It is the honest lower bound,
-- not a claim that the assignment was made exactly then.
--
-- changed_by is inferred, in order: the app's lead, else the oldest admin,
-- else the assignee themself (a last resort that only matters on a workspace
-- with no admin at all — the column is NOT NULL and there is no real actor to
-- name). Every backfilled row carries a note saying so, which is what
-- separates them from observed changes.
--
-- NOT EXISTS guard: this file must be safe to replay, since the
-- __drizzle_migrations bookkeeping in this project is known to be out of sync.
INSERT INTO "assignment_history"
  ("user_id", "app_id", "role", "allocation_pct", "effective_from", "effective_to",
   "changed_by", "change_kind", "note")
SELECT
  a."user_id",
  a."app_id",
  a."role",
  a."allocation_pct",
  GREATEST(u."created_at", ap."created_at") AT TIME ZONE 'UTC',
  NULL,
  COALESCE(
    ap."lead_id",
    (SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1),
    a."user_id"
  ),
  'assigned',
  'Backfilled from the live assignment when allocation history was introduced. effective_from is the earliest date the pairing was possible (later of the person''s and the app''s creation), and the actor is inferred, not recorded.'
FROM "assignments" a
JOIN "users" u ON u."id" = a."user_id"
JOIN "apps" ap ON ap."id" = a."app_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "assignment_history" h
  WHERE h."user_id" = a."user_id" AND h."app_id" = a."app_id"
);
