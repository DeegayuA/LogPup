import { count, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { webauthnCredentials } from '@/db/schema'
import { PasskeyNudgeBanner } from '@/features/auth/components/passkey-nudge-banner'

export const PASSKEY_NUDGE_COOKIE = 'logpup-passkey-nudge'

/**
 * The one-time "make next sign-in one tap" banner, shown on the dashboard to
 * a signed-in user with NO passkeys yet.
 *
 * This exists because of a discoverability dead end: the sign-in page's
 * passkey button is useless until a key is registered, and registration lives
 * behind Settings — a page nobody visits unprompted. The moment someone is
 * signed in is exactly the moment registering becomes possible, so that is
 * where the pointer goes.
 *
 * Dismissal is a COOKIE read here on the server, not client state: the server
 * decides render-or-null before any HTML ships, so there is no flash of a
 * banner the user dismissed last week and no hydration mismatch to paper
 * over. One count query, on an indexed column, only on the dashboard.
 */
export async function PasskeyNudge({ userId }: { userId: string }) {
  const jar = await cookies()
  if (jar.get(PASSKEY_NUDGE_COOKIE)?.value === '1') return null

  const [row] = await db
    .select({ n: count() })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
  if ((row?.n ?? 0) > 0) return null

  return <PasskeyNudgeBanner />
}
