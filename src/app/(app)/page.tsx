import { Suspense } from 'react'
import { getSession } from '@/lib/session'
import { PasskeyNudge } from '@/features/auth/components/passkey-nudge'
import { FirstLogNudge } from '@/features/worklog/components/first-log-nudge'
import {
  businessHourOf,
  formatBusinessWeekdayLong,
} from '@/features/people/format-instant'
import {
  MyDayZone,
  MyDayZoneSkeleton,
  PortfolioZone,
  PortfolioZoneSkeleton,
  TeamZone,
  TeamZoneSkeleton,
  UnreadMentionsPill,
} from '@/features/dashboard/components/dashboard-zones'

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Muted divider label between the page's zones. "My day" needs no label — it
 * starts at the greeting — but the switch from personal to team data, and
 * from team to portfolio, reads clearer with one word than with nothing.
 */
function ZoneLabel({ children }: { children: string }) {
  return (
    <h2 className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

/**
 * MY DAY FIRST, TEAM BELOW — the redesign's one organizing idea. The page
 * opens with the four numbers that are the signed-in user's own morning
 * briefing and the cards those numbers summarize (reused wholesale from
 * /people/[id], so "overdue" can never mean two different things on two
 * pages), then widens to the team (capacity, sprints), then to the whole
 * portfolio (health strip, the activity trail, approvals).
 *
 * THIS FILE IS NOW JUST THE SHELL. It reads one thing — who is signed in —
 * and hands off to three `<Suspense>` zones that fetch and stream
 * independently (see features/dashboard/components/dashboard-zones.tsx for
 * why, and for what each zone reads). The greeting and the page's structure
 * paint on the first flush; the zones fill in underneath as their own queries
 * land, in the order the page argues for them.
 *
 * The session read is `getSession`, so it costs nothing here — the (app)
 * layout already paid for it on this request (lib/session.ts).
 */
export default async function DashboardPage() {
  const session = await getSession()
  const user = session?.user
  const isAdmin = user?.role === 'admin'

  // Both the hour and the date resolve in the BUSINESS timezone, not the
  // server's. This renders on the server — UTC on Vercel — so `getHours()`
  // would wish a Colombo user good evening over their morning coffee, and
  // `format()` would print yesterday's date next to a "Meetings today" tile
  // that counts today's. See features/people/format-instant.ts.
  const now = new Date()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const greeting = firstName
    ? `${greetingFor(businessHourOf(now))}, ${firstName}`
    : greetingFor(businessHourOf(now))

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {greeting} · {formatBusinessWeekdayLong(now)}
          </p>
        </div>
        {user ? (
          <Suspense fallback={null}>
            <UnreadMentionsPill userId={user.id} />
          </Suspense>
        ) : null}
      </header>

      {/* Two one-time pointers, each rendering only while its own condition
          holds and each streaming on its own so neither can hold up the
          first paint. A brand-new account is the one case that sees both, so
          they share a shell and a muted voice — stacked, not competing.
          They stay unwrapped siblings deliberately: a container would hold
          the page's gap open for everyone who has already dealt with both.

          The work log comes first — it is the daily habit the product is
          for, and a dashboard of zeros says nothing about it (FirstLogNudge);
          the passkey pointer follows (PasskeyNudge). */}
      {user ? (
        <Suspense fallback={null}>
          <FirstLogNudge userId={user.id} />
        </Suspense>
      ) : null}
      {user ? (
        <Suspense fallback={null}>
          <PasskeyNudge userId={user.id} />
        </Suspense>
      ) : null}

      {/* ——— My day ——— */}
      {user ? (
        <Suspense fallback={<MyDayZoneSkeleton />}>
          <MyDayZone userId={user.id} userName={user.name ?? 'You'} />
        </Suspense>
      ) : null}

      {/* ——— Team ——— */}
      <ZoneLabel>Team</ZoneLabel>
      <Suspense fallback={<TeamZoneSkeleton />}>
        <TeamZone isAdmin={isAdmin} />
      </Suspense>

      {/* ——— Portfolio ——— */}
      <ZoneLabel>Portfolio</ZoneLabel>
      <Suspense fallback={<PortfolioZoneSkeleton />}>
        <PortfolioZone isAdmin={isAdmin} />
      </Suspense>
    </div>
  )
}
