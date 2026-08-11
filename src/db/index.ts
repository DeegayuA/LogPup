import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

// Lazily construct the client so importing this module does not require DATABASE_URL.
// Next.js evaluates route modules during `build` (page-data collection); creating the
// neon() client at import time would crash the build when the var is only present at
// runtime. Instead we fail on the first actual query if it is genuinely missing.
type Db = NeonHttpDatabase<typeof schema>

let cached: Db | undefined

function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    cached = drizzle(neon(url), { schema })
  }
  return cached
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb()
    const value = instance[prop as keyof Db]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
