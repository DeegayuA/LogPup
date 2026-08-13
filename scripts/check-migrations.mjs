// Warns, at `npm run dev`, when a migration in drizzle/ has never been applied
// to the database this app is pointed at.
//
// Why this exists: `meeting_recording_segments` sat unapplied for a whole
// feature's lifetime and nothing said so. The only symptom was that recording
// a meeting failed with "Upload failed — try again" — a message that blames
// the network, invites infinite retrying, and is wrong. There is no
// `db:migrate` habit to forget if there is no `db:migrate` script, so this is
// the other half of adding one: the drift is now stated out loud, at the one
// moment everybody is already looking at the terminal.
//
// Deliberately advisory: it prints and exits 0 even on drift. Someone working
// offline, on a laptop with no database reachable, or just reviewing a branch
// must still be able to start the dev server. Being *told* is the point;
// being *blocked* would only teach people to delete the script.

import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RED = '[31m'
const YELLOW = '[33m'
const BOLD = '[1m'
const RESET = '[0m'

// Table names created by the checked-in migrations. Parsed from the SQL rather
// than imported from schema.ts because schema.ts is TypeScript with app
// imports — this script has to stay a dependency-free .mjs that runs before
// anything is built.
function expectedTables() {
  const names = new Set()
  for (const file of readdirSync(join(root, 'drizzle')).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(root, 'drizzle', file), 'utf8')
    for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/gi)) {
      names.add(match[1])
    }
  }
  return names
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) return // No database configured — nothing to compare against.

  const expected = expectedTables()
  if (expected.size === 0) return

  let rows
  let sqlClient
  try {
    const { neon } = await import('@neondatabase/serverless')
    sqlClient = neon(url)
    rows = await sqlClient`select table_name from information_schema.tables where table_schema = 'public'`
  } catch {
    // Unreachable database, wrong credentials, offline laptop. Not this
    // script's job to complain about any of those — the app itself will.
    return
  }

  const present = new Set(rows.map((row) => row.table_name))
  const missingTables = [...expected].filter((name) => !present.has(name)).sort()

  // The authoritative check. Comparing table names only ever catches a
  // migration that CREATEs one — it stayed silent on 0020, which merely
  // widened tasks.sort_order to double precision and added an index, and an
  // unapplied 0020 breaks board ordering just as thoroughly as an unapplied
  // 0017 broke recording. Drizzle records each applied migration as
  // sha256(file contents) in drizzle.__drizzle_migrations, so diffing that
  // against the files on disk catches every kind of drift — new columns, type
  // changes, indexes, constraints — with no SQL parsing at all.
  let pending = []
  let edited = []
  try {
    const ledger = await sqlClient`select hash, created_at from drizzle.__drizzle_migrations`
    const applied = new Set(ledger.map((row) => row.hash))
    // Drizzle stamps each applied row's created_at with that migration's
    // `when` from the journal, so a `when` present in the ledger proves the
    // migration DID run — even when the file's hash no longer matches.
    const appliedStamps = new Set(ledger.map((row) => Number(row.created_at)))
    const whenByTag = new Map()
    try {
      const journal = JSON.parse(readFileSync(join(root, 'drizzle', 'meta', '_journal.json'), 'utf8'))
      for (const entry of journal.entries) whenByTag.set(`${entry.tag}.sql`, entry.when)
    } catch {
      // No journal (or unreadable): every mismatch simply reports as pending,
      // which is this script's pre-existing behaviour.
    }

    const unmatched = readdirSync(join(root, 'drizzle'))
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .filter(
        (file) =>
          !applied.has(createHash('sha256').update(readFileSync(join(root, 'drizzle', file), 'utf8')).digest('hex')),
      )

    // A hash mismatch has two very different causes, and telling someone to
    // run db:migrate is the wrong answer to one of them. `0023_sprint_checkins`
    // was applied and then edited afterwards (to make it replay-safe); its
    // table has existed ever since, yet it reported as "never applied" forever
    // and sent people looking for a schema problem that was not there. An
    // applied migration file is effectively immutable — editing so much as a
    // comment in one re-opens this.
    for (const file of unmatched) {
      const when = whenByTag.get(file)
      if (when !== undefined && appliedStamps.has(when)) edited.push(file)
      else pending.push(file)
    }
  } catch {
    // No drizzle bookkeeping schema yet (a fresh database, or one migrated
    // entirely by hand). The table check below still applies.
  }

  // Reported separately from real drift, and never as an error: the schema is
  // already correct, so `db:migrate` is not the fix and calling this "pending"
  // is what taught people to distrust this check and hand-apply SQL instead.
  if (edited.length > 0) {
    process.stderr.write(
      `\n${YELLOW}${BOLD}  Migration file edited after it was applied${RESET}\n` +
        `  ${edited.length} file${edited.length === 1 ? '' : 's'} in drizzle/ no longer ` +
        `match${edited.length === 1 ? 'es' : ''} the copy your database recorded:\n` +
        edited.map((file) => `    ${YELLOW}${file}${RESET}\n`).join('') +
        `  The schema change itself IS applied — nothing is broken and db:migrate\n` +
        `  will not help. An applied migration is immutable; put the change in a\n` +
        `  new migration and revert the edit, or re-record its hash.\n`,
    )
  }

  if (pending.length === 0 && missingTables.length === 0) return

  let message = `\n${RED}${BOLD}  Pending database migration${RESET}\n`
  if (pending.length > 0) {
    message +=
      `  ${pending.length} migration file${pending.length === 1 ? '' : 's'} in drizzle/ ` +
      `${pending.length === 1 ? 'has' : 'have'} never been applied to your database:\n` +
      pending.map((file) => `    ${YELLOW}${file}${RESET}\n`).join('')
  }
  if (missingTables.length > 0) {
    message +=
      `  ${missingTables.length} table${missingTables.length === 1 ? '' : 's'} defined in drizzle/ ` +
      `but missing from your database:\n` +
      missingTables.map((name) => `    ${YELLOW}${name}${RESET}\n`).join('')
  }
  const only = pending.length + missingTables.length === 1
  process.stderr.write(
    `${message}  Anything depending on ${only ? 'it' : 'them'} fails at runtime.\n` +
      `  Fix: ${BOLD}npm run db:migrate${RESET}\n\n`,
  )
}

await main()
