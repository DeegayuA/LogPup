/**
 * Does the DATABASE have every column src/db/schema.ts declares?
 *
 * This exists because of an outage that cost an evening. A column was added to
 * schema.ts while its migration sat written-but-unapplied — which reads, in a
 * git diff, exactly like a dormant change. It is not dormant: Drizzle names
 * every declared column in its SELECT, so the moment that column is in
 * schema.ts, EVERY read of that table fails for EVERY session with Postgres
 * 42703. The one that hurt was `users`, so the symptom was Auth.js reporting
 * AccessDenied on every sign-in — a permissions error, pointing nowhere near
 * the actual cause.
 *
 * check-migrations.mjs alongside this answers a different question: has every
 * FILE in drizzle/ been recorded as applied. That misses a hand-applied
 * migration, a partially-applied one, and a column someone declared without
 * writing a migration for at all. This compares the two things that actually
 * have to agree — the declaration and the database — and names the column.
 *
 * Reports and EXITS 0, deliberately. A developer whose database is behind
 * still needs `next dev` to start, and a preflight that blocks the only
 * command that can be used to investigate is a worse tool than the bug.
 */
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { neon } from '@neondatabase/serverless'
import * as schema from '../src/db/schema'

const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

type Drift = { table: string; missing: string[] }

function declaredTables(): { name: string; columns: string[] }[] {
  const tables: { name: string; columns: string[] }[] = []
  for (const value of Object.values(schema)) {
    // Views, enums, types and helpers all live in this module too; only real
    // tables carry drizzle's table symbol, which getTableConfig needs.
    if (!value || typeof value !== 'object') continue
    try {
      const config = getTableConfig(value as PgTable)
      tables.push({ name: config.name, columns: config.columns.map((column) => column.name) })
    } catch {
      // Not a table. Nothing to check.
    }
  }
  return tables
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    // Same posture as check-migrations: no database configured is a normal
    // state (a fresh clone, CI without secrets), not something to shout about.
    return
  }

  const sql = neon(url)
  let rows: { table_name: string; column_name: string }[]
  try {
    rows = (await sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
    `) as { table_name: string; column_name: string }[]
  } catch (error) {
    process.stderr.write(
      `\n${YELLOW}${BOLD}  Could not read the database schema${RESET}\n` +
        `  ${error instanceof Error ? error.message : String(error)}\n` +
        `  Skipping the schema-drift check.\n\n`,
    )
    return
  }

  const actual = new Map<string, Set<string>>()
  for (const row of rows) {
    const set = actual.get(row.table_name) ?? new Set<string>()
    set.add(row.column_name)
    actual.set(row.table_name, set)
  }

  const drift: Drift[] = []
  const absent: string[] = []
  for (const table of declaredTables()) {
    const columns = actual.get(table.name)
    // A table missing entirely is already check-migrations' message; saying it
    // twice in two different voices helps nobody.
    if (!columns) {
      absent.push(table.name)
      continue
    }
    const missing = table.columns.filter((column) => !columns.has(column))
    if (missing.length > 0) drift.push({ table: table.name, missing })
  }

  if (drift.length === 0) return

  const total = drift.reduce((sum, entry) => sum + entry.missing.length, 0)
  let message =
    `\n${YELLOW}${BOLD}  Schema declares columns your database does not have${RESET}\n` +
    `  ${total} column${total === 1 ? '' : 's'} in src/db/schema.ts ${total === 1 ? 'is' : 'are'} ` +
    `missing from the database:\n`
  for (const entry of drift) {
    message += `    ${YELLOW}${entry.table}${RESET}: ${entry.missing.join(', ')}\n`
  }
  message +=
    `\n  This is NOT dormant. Drizzle names every declared column in its SELECT,\n` +
    `  so every read of ${drift.length === 1 ? 'that table' : 'those tables'} fails right now with 42703 — for every\n` +
    `  session sharing this database, not just yours. On \`users\` it surfaces as\n` +
    `  Auth.js AccessDenied on sign-in, which points nowhere near the cause.\n` +
    `  Fix: apply the migration that adds ${total === 1 ? 'it' : 'them'} (${BOLD}npm run db:migrate${RESET}), or\n` +
    `  revert the declaration until the migration is ready. Land both or neither.\n\n`
  if (absent.length > 0) {
    message += `  (${absent.length} declared table${absent.length === 1 ? '' : 's'} absent entirely — see the migration check above.)\n\n`
  }
  process.stderr.write(message)
}

// Not top-level await: tsx transforms this file as CJS, where that is not
// available. A rejection here must not take `next dev` down with it either —
// the check is advisory, so it reports and gets out of the way.
main().catch((error) => {
  process.stderr.write(
    `\n  Schema-drift check failed to run: ${error instanceof Error ? error.message : String(error)}\n\n`,
  )
})
