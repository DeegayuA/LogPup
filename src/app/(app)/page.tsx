import { isAdminRole } from '@/features/auth/capabilities'
import { Suspense } from 'react'
import { getSession } from '@/lib/session'
import { PageHeader } from '@/components/ui/page-header'
import { PasskeyNudge } from '@/features/auth/components/passkey-nudge'
import { FirstLogNudge } from '@/features/worklog/components/first-log-nudge'
import {
  businessHourOf,
  formatBusinessWeekdayLong,
} from '@/features/people/format-instant'
import {
  AiZone,
  AiZoneSkeleton,
  MyDayZone,
  MyDayZoneSkeleton,
  PortfolioZone,
  PortfolioZoneSkeleton,
  TeamZone,
  TeamZoneSkeleton,
  UnreadMentionsPill,
  ZoneLabel,
} from '@/features/dashboard/components/dashboard-zones'

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const session = await getSession()
  const user = session?.user
  const isAdmin = user ? isAdminRole(user.role) : false

  const now = new Date()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const greeting = firstName
    ? `${greetingFor(businessHourOf(now))}, ${firstName}`
    : greetingFor(businessHourOf(now))

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      {/* Decorative only. The orbs are wider than the viewport by design, so
          they need clipping — but the clip belongs on THIS wrapper, not on the
          page root. `overflow-hidden` on the root makes it the nearest scroll
          container for everything inside, which silently stops `position:
          sticky` working for its descendants: the activity trail's day markers
          and the progress matrix's frozen person column both stick to a
          container that never scrolls. Same paint, without taking sticky
          positioning away from the whole page. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl"
        aria-hidden
      />
      </div>

      <PageHeader
        title="Studio Dashboard"
        description={`${greeting} · ${formatBusinessWeekdayLong(now)}`}
        actions={
          user ? (
            <Suspense fallback={null}>
              <UnreadMentionsPill userId={user.id} />
            </Suspense>
          ) : undefined
        }
      />

      {/* Two one-time pointers */}
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
        <>
          <h2 className="sr-only">My day</h2>
          <Suspense fallback={<MyDayZoneSkeleton />}>
            <MyDayZone userId={user.id} userName={user.name ?? 'You'} />
          </Suspense>
        </>
      ) : null}

      {/* ——— Team ——— */}
      <ZoneLabel>Team Capacity &amp; Sprints</ZoneLabel>
      <Suspense fallback={<TeamZoneSkeleton />}>
        <TeamZone isAdmin={isAdmin} />
      </Suspense>

      {/* ——— Portfolio ——— */}
      <ZoneLabel>App Portfolio &amp; Activity Trail</ZoneLabel>
      <Suspense fallback={<PortfolioZoneSkeleton />}>
        <PortfolioZone isAdmin={isAdmin} />
      </Suspense>

      {/* ——— AI engine ——— */}
      {/* Last, and only for a signed-in reader: every figure in it is that
          person's own ledger and their own key pool. There is no org-wide
          version of this zone to fall back to for a signed-out render. */}
      {user ? (
        <>
          <ZoneLabel>AI Engine &amp; Model Routing</ZoneLabel>
          <Suspense fallback={<AiZoneSkeleton />}>
            <AiZone userId={user.id} />
          </Suspense>
        </>
      ) : null}
    </div>
  )
}
