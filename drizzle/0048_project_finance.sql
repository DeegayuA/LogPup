-- Money: what an hour costs and what a project is worth.
--
-- THE SUBSTRATE ONLY. Three tables and a pure maths module; no action reads
-- or writes any of them yet, and nothing anywhere reads person_rates.
--
-- EVERY AMOUNT IS numeric, NEVER double precision. Allocation fractions in
-- this schema are floats because a rounding error there is cosmetic. Money
-- summed as a float drifts, and a cost report that disagrees with itself by a
-- cent between two screens is a report nobody trusts again.

-- What an hour of a given job role costs — the BASE rate, and the only one
-- most people ever have.
--
-- `role` is users.title, the job-role text already carried on a person,
-- matched by VALUE rather than by a foreign key: titles are free text an admin
-- types, and a rate card must keep pricing hours that were logged under a
-- title nobody holds today.
--
-- AS-OF INTERVALS, NEVER A MUTABLE NUMBER. Half-open [effective_from,
-- effective_to), the same shape as app_role_history and work_schedules. This
-- is the entire reason the table has a shape at all rather than being an
-- `hourly` column on a settings row: a rate that is simply EDITED silently
-- re-prices every hour ever worked, so last quarter's finished project changes
-- cost, months after it closed, because somebody got a raise this week.
--
-- DATE, not timestamptz, unlike those two history tables. A rate change is
-- something a person states as a calendar day ("from 1 July he bills at X"),
-- and worklog_entries.day is a date too — keying this to an instant would mean
-- picking an hour for the boundary, which is the Colombo/UTC off-by-one this
-- repo has been bitten by before.
CREATE TABLE IF NOT EXISTS "rate_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"hourly" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"set_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- The optional per-person override, for someone whose rate genuinely differs
-- from their role's. Same shape, same half-open interval, same resolution
-- rule; its ABSENCE means the role rate, which is the normal case.
--
-- THIS IS SALARY DATA. It is gated by its own capability, which DOES NOT EXIST
-- YET — the capability matrix belongs to another session and nobody currently
-- holds it. The table can land without that decision; anything that EXPOSES a
-- rate cannot, so no query, action or loader in this repo reads it, on
-- purpose. Whoever adds the first reader adds the gate in the same change.
CREATE TABLE IF NOT EXISTS "person_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"hourly" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"set_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- What a project is worth. One row per app.
--
-- TWO KINDS OF MONEY, TWO COLUMNS, NEVER ADDED TOGETHER. A fixed-price build
-- (contract_value) and a monthly retainer (subscription_monthly) answer
-- different questions, and one "worth" figure quietly merging them is the
-- two-numbers-under-one-name disease docs/kpi-inventory.md catalogues thirteen
-- instances of.
--
-- BOTH NULLABLE, and null means "not stated", never zero. An internal tool has
-- no contract value; that is not the same fact as a contract worth nothing.
--
-- SUBSCRIPTION IS A DATE RANGE, NOT A LEDGER. It is accrued by walking
-- [subscription_from, subscription_to) at READ time. There are deliberately no
-- per-month rows: a missed cron would silently under-report revenue, and the
-- under-report looks exactly like a quiet month.
CREATE TABLE IF NOT EXISTS "project_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"contract_value" numeric(14, 2),
	"subscription_monthly" numeric(14, 2),
	"subscription_from" date,
	"subscription_to" date,
	"currency" text NOT NULL,
	"set_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- set_by is ON DELETE no action throughout: losing the account of whoever set
-- a rate must never rewrite or remove the rate itself. What an hour cost in
-- June is a fact about June.
DO $$ BEGIN
	ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "person_rates" ADD CONSTRAINT "person_rates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "person_rates" ADD CONSTRAINT "person_rates_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "project_value" ADD CONSTRAINT "project_value_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "project_value" ADD CONSTRAINT "project_value_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- The only read on rate_cards: "every rate this role has ever had", walked to
-- find the one covering a day.
CREATE INDEX IF NOT EXISTS "rate_cards_role_from_idx" ON "rate_cards" USING btree ("role","effective_from");
--> statement-breakpoint
-- AT MOST ONE open interval per role, the same guard declared the same way as
-- app_role_history_one_open_idx and work_schedules_one_open_idx. Two open rows
-- would make "what did this role cost on 12 June" ambiguous, and an ambiguous
-- cost is worse than no cost at all.
CREATE UNIQUE INDEX IF NOT EXISTS "rate_cards_one_open_idx" ON "rate_cards" USING btree ("role") WHERE "effective_to" is null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_rates_user_from_idx" ON "person_rates" USING btree ("user_id","effective_from");
--> statement-breakpoint
-- Same invariant as rate_cards_one_open_idx, per person.
CREATE UNIQUE INDEX IF NOT EXISTS "person_rates_one_open_idx" ON "person_rates" USING btree ("user_id") WHERE "effective_to" is null;
--> statement-breakpoint
-- ONE row per app, enforced rather than assumed. Two rows would make "what is
-- this project worth" ambiguous in the one place the question is asked.
CREATE UNIQUE INDEX IF NOT EXISTS "project_value_app_idx" ON "project_value" USING btree ("app_id");
