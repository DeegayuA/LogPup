import { Suspense } from 'react'
import { format } from 'date-fns'
import { getSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { WorklogForm } from '@/features/worklog/components/worklog-form'
import { getMyWorklogs, getTeamWorklogs } from '@/features/worklog/queries'
import { resolveWorkDay, summarizeWorklogs, worklogDaysBack } from '@/features/worklog/worklog-day'

export const metadata = { title: 'Work log' }

/** How much history the personal list shows, and how far the team view looks back. */
const MY_DAYS = 14
const TEAM_DAYS = 7

/**
 * "What did I do today, and how much of what I planned did I get through?"
 *
 * One entry per person per day. The percentage is self-scored against the
 * person's own plan rather than derived from closed tickets, so a day of
 * meetings, review or debugging is not silently reported as zero — see
 * dailyWorklogs in src/db/schema.ts for why this is not sprintCheckins.
 *
 * Admins additionally see the whole team's last week, which is the point of
 * keeping a log at all: the gaps and the trend are the signal, not any one
 * day's number.
 */
export default async function WorklogPage() {
  const session = await getSession()
  if (!session?.user) return null

  const today = resolveWorkDay(new Date())
  const isAdmin = session.user.role === 'admin'

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Work log</h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(`${today}T12:00:00`), 'EEEE, MMMM d')} — one line about your day, and how
          far you got.
        </p>
      </div>

      {/* Only the data waits. The heading is on screen immediately, and the
          form arrives with today's entry already in it rather than flashing
          an empty box that then fills. */}
      <Suspense fallback={<FormSkeleton />}>
        <TodayEntry userId={session.user.id} today={today} />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <MyHistory userId={session.user.id} today={today} />
      </Suspense>

      {isAdmin ? (
        <Suspense fallback={<ListSkeleton rows={4} />}>
          <TeamHistory today={today} />
        </Suspense>
      ) : null}
    </div>
  )
}

async function TodayEntry({ userId, today }: { userId: string; today: string }) {
  const rows = await getMyWorklogs(userId, 1)
  const todayRow = rows.find((row) => row.day === today) ?? null
  return (
    <WorklogForm
      day={today}
      initial={todayRow ? { percent: todayRow.percent, note: todayRow.note } : null}
    />
  )
}

async function MyHistory({ userId, today }: { userId: string; today: string }) {
  const rows = await getMyWorklogs(userId, MY_DAYS)
  const byDay = new Map(rows.map((row) => [row.day, row]))
  // Every day in the window, logged or not: an unlogged day has to be
  // visible as a gap, otherwise the list quietly reads as a full record.
  const days = worklogDaysBack(MY_DAYS, new Date(`${today}T12:00:00Z`))
  const { logged, averagePercent } = summarizeWorklogs(rows)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">Your last {MY_DAYS} days</h2>
        <p className="text-2xs text-muted-foreground">
          {logged} logged
          {averagePercent !== null ? (
            <>
              {' · averaging '}
              <span className="font-mono tabular-nums text-foreground">{averagePercent}%</span>
              {' on the days you logged'}
            </>
          ) : null}
        </p>
      </div>

      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {days.map((day) => {
          const row = byDay.get(day)
          return (
            <li key={day} className="flex items-baseline gap-3 px-3 py-2">
              <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {format(new Date(`${day}T12:00:00`), 'EEE d MMM')}
              </span>
              {row ? (
                <>
                  <span className="w-12 shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {row.percent}%
                  </span>
                  <span className={cn(bilingualText, 'min-w-0 flex-1 text-sm')}>
                    {row.note ?? <span className="text-muted-foreground">No note</span>}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Not logged</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

async function TeamHistory({ today }: { today: string }) {
  const days = worklogDaysBack(TEAM_DAYS, new Date(`${today}T12:00:00Z`))
  const from = days[days.length - 1]
  const rows = await getTeamWorklogs(from, today)

  const byDay = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byDay.get(row.day) ?? []
    list.push(row)
    byDay.set(row.day, list)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-sm font-semibold">The team, last {TEAM_DAYS} days</h2>
        <p className="text-2xs text-muted-foreground">
          Each person&rsquo;s own account of their day. The percentages are self-scored against what
          each of them planned, so they read as a trend per person rather than a league table.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nobody has logged a day yet this week.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {days
            .filter((day) => byDay.has(day))
            .map((day) => (
              <div key={day} className="flex flex-col gap-1.5">
                <h3 className="font-mono text-xs tabular-nums text-muted-foreground">
                  {format(new Date(`${day}T12:00:00`), 'EEEE, MMMM d')}
                </h3>
                <ul className="flex flex-col divide-y rounded-xl border bg-card">
                  {(byDay.get(day) ?? []).map((row) => (
                    <li
                      key={`${row.userId}-${row.day}`}
                      className="flex items-baseline gap-3 px-3 py-2"
                    >
                      <span className="w-40 shrink-0 truncate text-sm font-medium">
                        {row.userName}
                      </span>
                      <span className="w-12 shrink-0 font-mono text-sm font-semibold tabular-nums">
                        {row.percent}%
                      </span>
                      <span className={cn(bilingualText, 'min-w-0 flex-1 text-sm')}>
                        {row.note ?? <span className="text-muted-foreground">No note</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </section>
  )
}

const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

function FormSkeleton() {
  return <div className={`${shimmer} h-64 rounded-xl`} />
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`${shimmer} h-4 w-40`} />
      <div className="flex flex-col gap-1.5 rounded-xl border p-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`${shimmer} h-5 w-full`} />
        ))}
      </div>
    </div>
  )
}
