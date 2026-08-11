'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { normalizePhone } from '@/lib/phone'
import { orgForEmail } from '@/lib/org-from-domain'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { onboardingInput } from '@/features/onboarding/schema'

// Completes the /pending onboarding form. userId always comes from the
// session — never from client input — so this can only ever touch the
// caller's own row, the same way setOwnPhone/setOwnPassword do (see
// features/auth/actions.ts). A company derivable from the caller's own email
// domain (src/lib/org-from-domain.ts) always overrides whatever the client
// sent for `organization`: the field is read-only-ish in the UI in that
// case, but the server re-derives it independently rather than trusting the
// client's copy of a value it was never supposed to be able to change.
export async function submitOnboarding(input: unknown): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) return err('Not signed in')

  const parsed = onboardingInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const normalizedPhone = normalizePhone(parsed.data.phone)
  if (!normalizedPhone) return err('That does not look like a phone number')

  const derivedOrg = orgForEmail(session.user.email)
  const orgTag = derivedOrg ?? parsed.data.organization

  await db
    .update(users)
    .set({ phone: normalizedPhone, orgTags: [orgTag] })
    .where(eq(users.id, session.user.id))

  revalidatePath('/pending')
  revalidatePath('/admin')
  return ok(undefined)
}
