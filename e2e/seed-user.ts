// Shared by `e2e/seed.ts` (the standalone `npm run e2e:seed` CLI) and
// `e2e/auth.setup.ts` (which seeds inline before logging in). Kept as a
// plain function — rather than a run-on-import script — so importing it
// never has a side effect beyond defining `seedDevUser`.
import './env'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import type { UserRole } from '@/features/auth/capabilities'

export type SeedResult = { id: string; email: string; role: UserRole; created: boolean }

/**
 * Insert-or-ignore the E2E/dev-login admin user. The credentials auth
 * provider (src/lib/auth.ts) already auto-provisions this exact email as
 * admin on first login, so in practice this is a no-op against the shared
 * dev DB — it exists so `e2e:seed` and CI can prime the row without going
 * through a browser first, and so a fresh DB doesn't depend on that
 * auto-provision path firing before this suite's other assertions run.
 */
export async function seedDevUser(): Promise<SeedResult> {
  const email = (process.env.DEV_LOGIN_EMAIL ?? '').trim().toLowerCase()
  if (!email) {
    throw new Error(
      'DEV_LOGIN_EMAIL is not set — required for the e2e credentials-bypass login (see .env.local).',
    )
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email))
  if (existing) {
    return { id: existing.id, email: existing.email, role: existing.role, created: false }
  }

  const [created] = await db
    .insert(users)
    .values({ email, name: email.split('@')[0], role: 'admin' })
    .onConflictDoNothing({ target: users.email })
    .returning()

  if (created) {
    return { id: created.id, email: created.email, role: created.role, created: true }
  }

  // Lost an insert race against another process (e.g. the auth provider's
  // own auto-provision, or a concurrent seed run) — re-read what landed.
  const [raced] = await db.select().from(users).where(eq(users.email, email))
  if (!raced) throw new Error(`seedDevUser: insert-or-ignore left no row for ${email}`)
  return { id: raced.id, email: raced.email, role: raced.role, created: false }
}
