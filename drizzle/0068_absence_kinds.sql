-- absence_kind gains the rest of the leave and excuse vocabulary.
--
-- The picker offered six kinds against a studio that files far more than six.
-- Anything unlisted had to go in as 'annual' (which spends the wrong
-- entitlement), 'other' (true but invisible in every breakdown) or not at all
-- — and "not at all" is the one that matters, because a day nobody could
-- describe honestly stayed on the catch-up ledger as unexplained.
--
--   half_day     — worked half, off half
--   short_leave  — an hour or two: late in, early out, an appointment
--   lieu         — a day back for a holiday or weekend that was worked
--   duty         — studio business away from the studio
--   bereavement  — a death in the family
--   parental     — maternity or paternity
--
-- THE TWO PART-DAY KINDS EXEMPT NOTHING BY THEMSELVES, and that is a decision,
-- not an omission. `absences` has no hours column and coverage.ts exempts days
-- whole; letting a half day through the exemption would write off a full day
-- for two hours at the dentist. exemptsWholeDay in
-- src/features/worklog/absence-kinds.ts holds that rule and
-- absence-kinds.test.ts pins it, so these kinds are recorded and approved like
-- any other while the day stays owed. Fractional exemption is a separate
-- design in coverage.ts and this migration deliberately does not prejudge it.
--
-- NO DO $$ GUARD, deliberately, and for the same reason as 0037, 0053 and
-- 0067: ALTER TYPE ... ADD VALUE is not permitted inside a function or
-- transaction block on all paths, so the usual EXCEPTION WHEN duplicate_object
-- idiom cannot wrap it. ADD VALUE IF NOT EXISTS gives the same replay safety
-- on its own.
--
-- APPENDED, never positioned with BEFORE/AFTER. Enum sort order is physical
-- order, and nothing in src/ orders by this column: display order comes from
-- ABSENCE_KIND_DEFINITIONS. A BEFORE anchor would tie this migration to a
-- value somebody could later rename.
--
-- ONE STATEMENT PER VALUE with a breakpoint between them, because ADD VALUE
-- cannot be batched inside a single transaction on every path.
--
-- CARRIES NO ENTITLEMENT. These are categories, not balances — nothing in the
-- schema tracks a per-person allowance for 'annual' either.
ALTER TYPE "public"."absence_kind" ADD VALUE IF NOT EXISTS 'half_day';--> statement-breakpoint
ALTER TYPE "public"."absence_kind" ADD VALUE IF NOT EXISTS 'short_leave';--> statement-breakpoint
ALTER TYPE "public"."absence_kind" ADD VALUE IF NOT EXISTS 'lieu';--> statement-breakpoint
ALTER TYPE "public"."absence_kind" ADD VALUE IF NOT EXISTS 'duty';--> statement-breakpoint
ALTER TYPE "public"."absence_kind" ADD VALUE IF NOT EXISTS 'bereavement';--> statement-breakpoint
ALTER TYPE "public"."absence_kind" ADD VALUE IF NOT EXISTS 'parental';
