import { cookies } from 'next/headers'
import { FirstLogNudgeBanner } from '@/features/worklog/components/first-log-nudge-banner'
import { countMyWorklogDays } from '@/features/worklog/queries'

export const FIRST_LOG_NUDGE_COOKIE = 'logpup-first-log-nudge'

/**
 * The one-time "this is the daily habit" banner, shown on the dashboard to a
 * signed-in user who has NEVER logged a day.
 *
 * A brand-new account opens on four zero tiles and four empty cards, and
 * nothing on the page says the zeros are waiting on them rather than broken.
 * The work log's own explanation — what the percentage means, which days
 * count — lives on /worklog, and its catch-up panel only appears once
 * somebody is already behind. So the first pointer has to come from here.
 *
 * Modelled on PasskeyNudge (src/features/auth/components/passkey-nudge.tsx),
 * mechanism and all: dismissal is a COOKIE read on the server, not client
 * state, so render-or-null is decided before any HTML ships — no flash of a
 * banner dismissed last week, no hydration mismatch. One count query, on an
 * indexed column, only on the dashboard.
 */
export async function FirstLogNudge({ userId }: { userId: string }) {
  const jar = await cookies()
  if (jar.get(FIRST_LOG_NUDGE_COOKIE)?.value === '1') return null

  if ((await countMyWorklogDays(userId)) > 0) return null

  return <FirstLogNudgeBanner />
}
