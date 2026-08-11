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
  try {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(url)
    rows = await sql`select table_name from information_schema.tables where table_schema = 'public'`
  } catch {
    // Unreachable database, wrong credentials, offline laptop. Not this
    // script's job to complain about any of those — the app itself will.
    return
  }

  const present = new Set(rows.map((row) => row.table_name))
  const missing = [...expected].filter((name) => !present.has(name)).sort()
  if (missing.length === 0) return

  const plural = missing.length === 1 ? 'table is' : 'tables are'
  process.stderr.write(
    `\n${RED}${BOLD}  Pending database migration${RESET}\n` +
      `  ${missing.length} ${plural} defined in drizzle/ but missing from your database:\n` +
      missing.map((name) => `    ${YELLOW}${name}${RESET}\n`).join('') +
      `  Anything that uses ${missing.length === 1 ? 'it' : 'them'} fails at runtime.\n` +
      `  Fix: ${BOLD}npm run db:migrate${RESET}\n\n`,
  )
}

await main()
