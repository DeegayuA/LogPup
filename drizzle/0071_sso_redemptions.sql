-- Sign-in handoff replay guard for the Attendance Web App bridge.
-- See docs/attendance-task-bridge.md, Part two.
--
-- One row per REDEEMED handoff token, keyed by the JWT's jti. The token travels in a URL, and
-- URLs survive in browser history, referrer headers and proxy logs, so a short expiry narrows
-- the replay window without closing it.
--
-- The PRIMARY KEY is the whole mechanism: redemption is an INSERT, and a replay violates the
-- key. The write IS the check, so two tabs opening the same link race in the database and only
-- one can win. A read-then-insert would let both through.
--
-- Deliberately NOT a reuse of webauthn_login_tokens: that table means "a passkey login is in
-- flight", and rows in it that came from somewhere else would make its name a lie.
--
-- No foreign key to users: this records that a TOKEN was spent, not that a person exists. The
-- row must outlive an account deletion, or deleting a user would un-spend their tokens.
CREATE TABLE IF NOT EXISTS "sso_redemptions" (
	"jti" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- Retention sweep reads this ("everything already expired"); see the notify-tick cron.
CREATE INDEX IF NOT EXISTS "sso_redemptions_expires_idx" ON "sso_redemptions" ("expires_at");
