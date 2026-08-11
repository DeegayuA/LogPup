import crypto from 'node:crypto'
import fs from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const sql = neon(url)

  const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'))
  const gapTags = ['0002_gemini-meeting-ai', '0003_user-invites', '0004_user-phone']

  const existing = await sql`select hash from drizzle.__drizzle_migrations`
  const existingHashes = new Set(existing.map((r: { hash: string }) => r.hash))

  for (const entry of journal.entries) {
    if (!gapTags.includes(entry.tag)) continue
    const content = fs.readFileSync(`drizzle/${entry.tag}.sql`, 'utf8')
    const hash = crypto.createHash('sha256').update(content).digest('hex')
    if (existingHashes.has(hash)) {
      console.log('already tracked, skipping', entry.tag)
      continue
    }
    await sql`insert into drizzle.__drizzle_migrations ("hash", "created_at") values (${hash}, ${entry.when})`
    console.log('reconciled bookkeeping for', entry.tag, hash)
  }

  console.log('--- rows after reconciliation ---')
  const after = await sql`select id, hash, created_at from drizzle.__drizzle_migrations order by id`
  console.log(JSON.stringify(after, null, 2))

  console.log('--- running migrate() to apply remaining pending migrations (0005, 0006) ---')
  const db = drizzle(sql)
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('migrate() completed')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('ERROR', e)
  process.exit(1)
})
