-- The monthly AI spend cap, per person.
--
-- Design: the user's request — warn at 90%, refuse at 100%, default $10.
--
-- ADDITIVE. NOT NULL with a default that is correct for every existing row:
-- nobody had a cap before, and ten dollars a month is roughly a working month
-- of flash-tier calls for one person — a ceiling that catches a runaway loop
-- rather than one that interrupts ordinary work.
--
-- numeric(10,2), not a float. Money compared against a threshold must not carry
-- binary rounding error: at 0.1 + 0.2 a double is 0.30000000000000004, and the
-- one place that matters is exactly here, where the comparison decides whether
-- somebody is allowed to work.
--
-- ZERO IS A MEANINGFUL VALUE and is checked for: it means "no AI for this
-- seat", never "unlimited". The division that would make it unlimited is
-- refused explicitly in budget.ts.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_budget_usd" numeric(10, 2) DEFAULT '10.00' NOT NULL;--> statement-breakpoint

-- The spend read is "this person, this calendar month", and ai_usage_events had
-- no index that serves it with the model column in hand — the existing
-- (user_id, created_at) index does not cover `model`, so every budget check
-- would heap-fetch each row to find out what it cost.
CREATE INDEX IF NOT EXISTS "ai_usage_user_month_idx" ON "ai_usage_events" USING btree ("user_id","created_at","model");
