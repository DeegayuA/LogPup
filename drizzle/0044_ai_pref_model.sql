-- Which model this user picked for this feature. NULL means "use the feature's
-- default chain" — the same absent-means-default convention `enabled` follows.
-- A chosen model is PREPENDED to that chain, never substituted for it, so a
-- model Google retires degrades to the default instead of breaking the feature.
ALTER TABLE "user_ai_prefs" ADD COLUMN IF NOT EXISTS "model" text;
