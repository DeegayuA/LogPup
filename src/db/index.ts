import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'
import { gateBatch, gateWrite } from './write-gate'

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

/** The three methods that change rows. Reads pass through untouched. */
const WRITE_METHODS = new Set(['insert', 'update', 'delete'])

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb()
    const value = instance[prop as keyof Db]
    if (typeof value !== 'function') return value
    const bound = (value as (...args: unknown[]) => unknown).bind(instance)

    // THE MAINTENANCE WRITE FREEZE. See src/db/write-gate.ts for what it does
    // and, more importantly, for why reads are deliberately not gated. When no
    // window is armed both arms hand the original straight back, so this is a
    // no-op on every ordinary request.
    if (WRITE_METHODS.has(prop as string)) {
      return (...args: unknown[]) => gateWrite(args[0], bound(...args))
    }
    if (prop === 'batch') {
      return async (...args: unknown[]) => {
        await gateBatch(args[0])
        return bound(...args)
      }
    }
    return bound
  },
})
