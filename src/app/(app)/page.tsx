import { Fragment, Suspense } from 'react'
import { getSession } from '@/lib/session'
import { loadActor } from '@/features/auth/actor'
import { composeDashboard } from '@/features/dashboard/zones'
import { PageHeader } from '@/components/ui/page-header'
import { PasskeyNudge } from '@/features/auth/components/passkey-nudge'
import { FirstLogNudge } from '@/features/worklog/components/first-log-nudge'
import {
  businessHourOf,
  formatBusinessWeekdayLong,
} from '@/features/people/format-instant'
import {
  UnreadMentionsPill,
  ZONE_VIEWS,
  ZoneLabel,
} from '@/features/dashboard/components/dashboard-zones'

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * A ROLE-SHAPED DASHBOARD: whatever `composeDashboard` says, in the order it
 * says it, each zone in its own Suspense boundary.
 *
 * There is no `isAdmin` on this page any more, and deliberately no branch that
 * names a role. The old version gated its last two zones on
 * `isAdminRole(session.role)` — with seven seats that collapsed manager,
 * editor, member, stakeholder and auditor into one "not admin" view, and it
 * was the exact role comparison capabilities.ts exists to forbid.
 *
 * The zone list is the authority now. A role that gains a capability gains its
 * zone here with no edit to this file: the registry admits it, the ordering
 * hint places it, and ZONE_VIEWS knows what to draw.
 */
export default async function DashboardPage() {
  // Both request-cached, and the layout has already paid for the session — so
  // this is one extra read (the employment type and the actor's app scope),
  // not two round trips.
  const [session, actor] = await Promise.all([getSession(), loadActor()])
  const user = session?.user

  // No actor means no zones, not a smaller set of them. `loadActor` returns
  // null for a signed-out reader and for a deactivated account — the layout
  // redirects both before this renders, so reaching here with null is a
  // defence, and the honest answer to "what may they see" is nothing.
  const zones = actor ? composeDashboard(actor) : []

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
        title="LogPup 🐾 Dashboard"
        description={`${greeting} · ${formatBusinessWeekdayLong(now)}`}
        actions={
          user ? (
            <Suspense fallback={null}>
              <UnreadMentionsPill userId={user.id} />
            </Suspense>
          ) : undefined
        }
      />

      {/* Two one-time pointers, above the zones for every reader: they are
          about this account, not about anything a capability decides. */}
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

      {/* One boundary per zone, as before, so the page still streams controls
          before data — and so a slow portfolio scan never holds up somebody's
          own day. */}
      {actor
        ? zones.map((zone) => {
            const { Zone, Skeleton } = ZONE_VIEWS[zone.id]
            return (
              <Fragment key={zone.id}>
                <ZoneLabel hidden={zone.labelHidden}>{zone.label}</ZoneLabel>
                <Suspense fallback={<Skeleton />}>
                  <Zone actor={actor} grant={zone.grant} userName={user?.name ?? 'You'} />
                </Suspense>
              </Fragment>
            )
          })
        : null}
    </div>
  )
}
