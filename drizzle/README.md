# drizzle/ migrations

This directory is managed by `drizzle-kit`. `drizzle/meta/_journal.json` is the
source of truth for migration order; each entry's `tag` maps to a `.sql` file
here, and its `when` (epoch millis) is the value drizzle-kit stores as
`created_at` in the bookkeeping table once that migration has been applied.

## 2026-08-12: migration ledger was out of sync with the database

**Symptom:** `npx drizzle-kit migrate` failed, complaining that objects it was
trying to create already existed.

**Root cause:** over the project's history, several migrations were applied
directly against the Neon database (hand-run SQL, or `drizzle-kit push`)
without going through `drizzle-kit migrate`, so they were never recorded in
the bookkeeping table `drizzle.__drizzle_migrations` (schema `drizzle`, table
`__drizzle_migrations`, columns `id serial`, `hash text`, `created_at
bigint`). The migrator only looks at the single most recent row (`order by
created_at desc limit 1`) and re-runs every migration file whose journal
`when` is greater than that row's `created_at`, so any gap at the tail of the
ledger causes already-applied `CREATE TABLE` / `ADD COLUMN` statements to be
re-executed and fail. (0019/0021/0022 were later written with
`IF NOT EXISTS` / `DO $$ ... EXCEPTION WHEN duplicate_object` guards
specifically to survive being re-run against a database where they'd already
been applied by hand — see the comments in those files.)

**How it was diagnosed and fixed:** for every entry in `_journal.json`, the
live database was queried (`information_schema` + `pg_constraint` +
`pg_indexes`) to confirm the tables/columns/constraints/indexes that
migration creates already existed with the exact shape the `.sql` file
specifies. Only migrations that were verified as fully (not partially)
applied were reconciled. The bookkeeping table was then repaired by
inserting one row per genuinely-applied-but-unrecorded migration, computing
`hash` the same way drizzle-orm does — `sha256(fs.readFileSync(file))` hex
digest of the raw `.sql` file bytes (see
`node_modules/drizzle-orm/migrator.cjs`, `readMigrationFiles`) — and using
the journal entry's `when` as `created_at`. No application data was read,
inserted, updated, or deleted; only rows in the bookkeeping table were
touched, and only after each corresponding schema change was independently
confirmed present. By the time this reconciliation was verified, a
concurrent process had already applied the fix (and a newly-added migration,
`0023_sprint_checkins`) the same way; the end state was independently
re-verified here: every journal entry's computed hash matches its
bookkeeping row exactly, `npx drizzle-kit migrate` completes as a no-op, and
`npx drizzle-kit check` reports no drift.

## Rule going forward

- Generate migrations with `npx drizzle-kit generate` (or `npm run
  db:generate`) and apply them with `npx drizzle-kit migrate` (or `npm run
  db:migrate`). Don't use `drizzle-kit push` or hand-run SQL against the
  shared database — that's what caused this drift.
- If a migration ever *must* be applied by hand in an emergency, record it in
  `drizzle.__drizzle_migrations` **in the same commit**:

  ```sql
  insert into drizzle.__drizzle_migrations (hash, created_at)
  values ('<sha256 hex digest of the raw .sql file bytes>', <journal entry's "when", epoch millis>);
  ```

  The hash must be the sha256 hex digest of the exact bytes of the
  migration's `.sql` file (whatever is in the migrations folder at the time),
  not of any reformatted or copy-pasted version — drizzle-kit does not
  actually check this hash before applying, but it's the authoritative
  audit trail. Consider also making the migration itself idempotent
  (`IF NOT EXISTS` / `DO $$ ... EXCEPTION WHEN duplicate_object THEN null;
  END $$;`) in case someone re-runs `drizzle-kit migrate` before the
  bookkeeping row lands.
