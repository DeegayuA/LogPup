import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { users } from '@/db/schema'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { loadActor } from '@/features/auth/actor'
import { getSession } from '@/lib/session'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { getMemberScorecard, getPersonSignals, heldRoles } from '@/features/signals/queries'
import { SignalsHelp, SignalsView } from '@/features/signals/components/signals-view'
import type { Scorecard } from '@/features/signals/roles/shared'

export const metadata: Metadata = {
  title: 'Work signals',
  description: 'What this workspace can and cannot see about a stretch of work.',
}

/**
 * DEFAULTS TO YOU, ALWAYS.
 *
 * `?user=` exists for anyone holding `worklog.view`, but the bare URL is your
 * own page and the palette row is "My work signals". That ordering is fairness
 * rule 5 made navigational: every figure a manager can see about a person is
 * on that person's own page, in the same words — and a rule like that is only
 * real if the person reaches it by default rather than by being shown it.
 *
 * A fortnight is the default window. Short enough that a quiet stretch inside
 * it is still recent enough to ask about, long enough that one hard week does
 * not become the whole picture.
 */
const DEFAULT_WINDOW_DAYS = 14

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; from?: string; to?: string }>
}) {
  const [session, actor, params] = await Promise.all([getSession(), loadActor(), searchParams])
  if (!session?.user) redirect('/sign-in')
  if (!actor) redirect('/')

  const userId = params.user ?? session.user.id
  const today = toIsoDateInTimeZone(new Date())
  const to = params.to ?? today
  const from =
    params.from
    ?? new Date(Date.parse(`${to}T00:00:00Z`) - (DEFAULT_WINDOW_DAYS - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10)

  const signals = await getPersonSignals(actor, userId, from, to)
  if (!signals) {
    // Indistinguishable from "no such person" on purpose: whether a named
    // colleague exists is not something an unauthorised reader gets to learn
    // from the shape of a refusal.
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <PageHeader title="Work signals" />
        <EmptyState
          title="Not available"
          description="You can read your own work signals, and those of anyone whose worklog you already have access to."
        />
      </div>
    )
  }

  const isSelf = userId === session.user.id
  const [person] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId))
  const [roles, member] = await Promise.all([
    heldRoles(userId, from, to),
    getMemberScorecard(actor, userId, from, to),
  ])

  // Only the IC card is assembled today. PM, lead and architect cards are
  // built and tested (roles/*.ts) but their query assembly lands with spec #2
  // — listing the roles held here rather than rendering an empty card is the
  // honest interim: it says what is coming without pretending it arrived.
  const scorecards: Scorecard<string>[] = member ? [member] : []

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        title={isSelf ? 'My work signals' : `${person?.name ?? 'Someone'}’s work signals`}
        description={
          roles.length > 1
            ? `Roles held in this window: ${roles.join(', ')}.`
            : 'What this workspace could and could not see.'
        }
      />
      <SignalsHelp />
      <SignalsView
        signals={signals}
        scorecards={scorecards}
        personName={person?.name ?? 'they'}
        isSelf={isSelf}
      />
    </div>
  )
}
