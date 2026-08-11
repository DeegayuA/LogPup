'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { AuthError } from 'next-auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { auth, signIn } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { RateLimitError } from '@/lib/rate-limit'
import { ok, err, type ActionResult } from '@/lib/action-result'

// Sign in an existing password account. Wrong credentials surface as a friendly error;
// the NEXT_REDIRECT thrown on success must propagate, so only AuthError is swallowed.
// A rate-limit lockout (thrown from authorize() as RateLimitError, see src/lib/auth.ts)
// is surfaced with its own distinct message instead of the generic invalid-credentials one.
export async function loginWithPassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) return err('Enter your email and password')
  try {
    await signIn('password', { email, password, redirectTo: '/' })
  } catch (e) {
    if (e instanceof AuthError) {
      const cause = (e.cause as { err?: unknown } | undefined)?.err
      if (cause instanceof RateLimitError) return err(cause.message)
      return err('Invalid email or password')
    }
    throw e
  }
  return ok(undefined)
}

const setPasswordInput = z.object({
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
})

// Lets an already-authenticated user set (or change) their own password — this is the
// ONLY way a passwordHash gets written. There is no public/unauthenticated registration
// path: it would let anyone set a password on any existing account (all rows start with
// a NULL passwordHash), which is an account takeover. This only ever updates the
// session user's own row; it never inserts a user or touches anyone else's account.
export async function setOwnPassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('You must be signed in')

  const parsed = setPasswordInput.safeParse({ password: formData.get('password') })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  // Clearing mustChangePassword here releases the first-login gate in
  // src/proxy.ts — the jwt callback re-reads the row on the next request.
  const passwordHash = hashPassword(parsed.data.password)
  await db.update(users)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(users.id, session.user.id))

  return ok(undefined)
}
