-- users.github_login: the GitHub username a person sets on their own profile.
--
-- Nullable, no default, no unique: it is contact/profile metadata in the same
-- class as phone and personal_email — never identity. No sign-in path reads
-- it, so a typo (or a colleague's name typed here maliciously) can misattribute
-- commits at worst, never grant access. The GitHub App integration uses it to
-- filter org commit history by author; a NULL simply means that person's
-- worklog autofill gets no commit evidence.
ALTER TABLE "users" ADD COLUMN "github_login" text;
