import fs from 'node:fs'
import { neon } from '@neondatabase/serverless'

// Applies ONLY drizzle/0006_user-status.sql's literal statements directly.
// Does not touch drizzle.__drizzle_migrations bookkeeping (a pre-existing,
// unrelated gap in that table — see migrations 0002-0004 which are already
// live in the DB but untracked there — is out of scope for this change).
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const sql = neon(url)

  const content = fs.readFileSync('drizzle/0006_user-status.sql', 'utf8')
  const statements = content.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)

  for (const stmt of statements) {
    console.log('--- executing ---')
    console.log(stmt)
    await sql.query(stmt)
  }
  console.log('0006_user-status.sql applied')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('ERROR', e)
  process.exit(1)
})
