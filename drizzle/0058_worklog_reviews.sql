-- Reviews on a person's day: a second statement ABOUT the log, never a rewrite
-- OF it.
--
-- WHY THIS IS A NEW TABLE AND NOT A COLUMN. daily_worklogs is a FIRST-PERSON
-- record — there is deliberately no worklog.write.any capability for any seat,
-- and capabilities.test.ts asserts the key does not exist — so a reviewer's
-- words cannot live on that row without making somebody else a co-author of a
-- sentence written in the subject's name. A separate row, attributed to its own
-- author, is what lets a lead answer a day without editing it.
--
-- NOT KEYED TO daily_worklogs. The reference is (subject_user_id, day), not a
-- foreign key to a worklog row, because a day can carry hours and no score —
-- the `partial` state — and that day is exactly the one a lead most wants to
-- ask about. Keying to the score would make the unscored day unreviewable.
--
-- SOFT DELETE, like every other content table here: deleted_at plus a live
-- view registered in db/live.ts, never a DELETE.

CREATE TABLE IF NOT EXISTS "worklog_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"day" date NOT NULL,
	"reviewer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid REFERENCES "users"("id")
);
--> statement-breakpoint
-- The read every surface makes: "the reviews on this person's day". Partial on
-- deleted_at to match how the live view queries it.
CREATE INDEX IF NOT EXISTS "worklog_reviews_subject_day_live_idx" ON "worklog_reviews" ("subject_user_id","day") WHERE "deleted_at" is null;
--> statement-breakpoint
-- "what have I reviewed" — the reviewer's own trail, and the read behind any
-- future "who helps others" figure.
CREATE INDEX IF NOT EXISTS "worklog_reviews_reviewer_live_idx" ON "worklog_reviews" ("reviewer_id") WHERE "deleted_at" is null;
