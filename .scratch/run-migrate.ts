import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const db = drizzle(neon(url))
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('migrations applied (neon-http)')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('MIGRATE ERROR', e)
  process.exit(1)
})
