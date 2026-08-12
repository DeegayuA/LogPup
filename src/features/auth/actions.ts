'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { AuthError } from 'next-auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { auth, signIn } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { RateLimitError } from '@/lib/rate-limit'
import { normalizePhone } from '@/lib/phone'
import { revalidatePath } from 'next/cache'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'

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
/** Self-serve contact number — anyone can set their own; blank clears it. */
export async function setOwnPhone(phone: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const trimmed = phone.trim()
  const value = trimmed === '' ? null : normalizePhone(trimmed)
  if (trimmed !== '' && value === null) return err('That does not look like a phone number')

  await db.update(users).set({ phone: value }).where(eq(users.id, session.user.id))
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'user',
    entityId: session.user.id,
    entityLabel: session.user.name ?? session.user.email,
    pagePath: `/people/${session.user.id}`,
    detail: value === null ? 'clearing their phone number' : 'their phone number',
    metadata: { phone: { to: value } },
  })
  revalidatePath('/profile')
  revalidatePath('/people')
  return ok(undefined)
}

// There is deliberately no self-serve job-role action here. users.title is
// admin-only — see setUserTitle in features/admin/actions.ts. A server action
// exported from this file would keep a stable, callable endpoint even with no
// UI pointing at it, so the only safe way to make the field admin-only was to
// delete the action outright rather than hide its control.

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

  // Deliberately no metadata: nothing password-derived belongs in the trail.
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'user',
    entityId: session.user.id,
    entityLabel: session.user.name ?? session.user.email,
    pagePath: `/people/${session.user.id}`,
    detail: 'their password',
  })

  revalidatePath('/profile')
  return ok(undefined)
}
