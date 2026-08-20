import { Suspense } from 'react'
import { format } from 'date-fns'
import { getSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import { isMercantileHoliday } from '@/lib/lk-holidays'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { loadActor } from '@/features/auth/actor'
import { can, isAdminRole } from '@/features/auth/capabilities'
import { WorklogForm } from '@/features/worklog/components/worklog-form'
import {
  DeclareAbsenceDialog,
  type FiledAbsence,
} from '@/features/worklog/components/declare-absence-dialog'
import { PendingAbsenceList } from '@/features/worklog/components/pending-absence-list'
import {
  getMyApprovedAbsences,
  getMyPendingAbsences,
  getMyWorkSchedule,
  getMyWorklogDays,
  getMyWorklogs,
  getOrgHolidayDays,
  getTeamWorklogs,
  getUserJoinDay,
  type MyAbsence,
} from '@/features/worklog/queries'
import { computeCoverage, type CoverageStatus } from '@/features/worklog/coverage'
import { patternForDay } from '@/features/worklog/schedules'
import { MAX_BACKFILL_DAYS } from '@/features/worklog/missing-days'
import { resolveWorkDay, worklogDaysBack } from '@/features/worklog/worklog-day'
import { getAiPrefs } from '@/features/gemini/prefs'

export const metadata = { title: 'Work log' }

/** How much history the personal list shows, and how far the team view looks back. */
const MY_DAYS = 14
const TEAM_DAYS = 7

/**
 * How far back the catch-up panel computes coverage — the same safety bound
 * missing-days.ts walked. Long enough to still find MAX_BACKFILL_DAYS owed
 * days on the far side of a long absence, short enough that the window is a
 * fixed cost however long somebody has been here.
 */
const CATCH_UP_WINDOW_DAYS = 120

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
  const isAdmin = isAdminRole(session.user.role)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Work log</h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(`${today}T12:00:00`), 'EEEE, MMMM d')} — one line about your day, and how
          far you got.
        </p>
        {/* The rules live here, not only inside the catch-up panel: that panel
            renders only for somebody already behind, so a person who has never
            missed a day would never be told how the days are counted. */}
        <p className="text-2xs text-muted-foreground">
          Gazetted public holidays and company holidays never count. Otherwise Monday to Friday are
          whole days and Saturday is a half day, unless your own work schedule says different. Days
          you missed wait above today&rsquo;s box, up to {MAX_BACKFILL_DAYS} at once; approved leave
          is not one of them. What you save appears in your own list below, and in the team view
          that admins see. Only you can write your entries — nobody else can log a day for you.
        </p>
      </div>

      {/* Only the data waits. The heading is on screen immediately, and the
          form arrives with today's entry already in it rather than flashing
          an empty box that then fills. */}
      {/* Earlier days come FIRST, above today's box. They are the ones a
          person has to decide about — fill in or leave blank — and burying
          them under today's entry is how a list nobody reads is made. */}
      <Suspense fallback={null}>
        <CatchUp userId={session.user.id} today={today} />
      </Suspense>

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

/**
 * Earlier days with no entry, and what the person has already said about them.
 *
 * TWO groups, because "I have not dealt with this day" and "I have dealt with
 * it and somebody else has not" are different states, and only the first is a
 * to-do list:
 *
 *   owed, nothing filed        a box to log it in
 *   filed, awaiting approval   named below, with its kind and its dates
 *   approved                   gone from the panel — the day is not owed
 *
 * Which days are owed now comes from `computeCoverage` rather than
 * `missingWorkDays`. Not because the older one broke — it still answers the
 * question it was asked — but because coverage answers more: approved leave,
 * company holidays and a person's own work schedule, each as a status per
 * day. That is what lets ONE filter (`status === 'missing'`) drop exempt, off
 * and not-yet-due days at once, today's own day included, by rule rather than
 * by a special case for today.
 *
 * Renders nothing when both groups are empty — a permanently-present panel
 * showing zero is noise that teaches people to ignore the area where the real
 * prompt appears. Deliberately not styled as a warning: people take leave and
 * spend days on other work, and a blank day is not a fault.
 */
async function CatchUp({ userId, today }: { userId: string; today: string }) {
  // Half-open [from, to), and `to` is tomorrow so today sits INSIDE the window
  // and falls out of the gap list as `not-yet-due` — the same rule that drops
  // a Sunday, rather than a special case that has to be remembered.
  const from = shiftDay(today, -CATCH_UP_WINDOW_DAYS)
  const to = shiftDay(today, 1)

  const [actor, joinedOn, loggedDays, pending, approved, schedule, companyHolidays, aiPrefs] =
    await Promise.all([
      loadActor(),
      getUserJoinDay(userId),
      getMyWorklogDays(userId, from, today),
      getMyPendingAbsences(userId),
      getMyApprovedAbsences(userId, from, today),
      getMyWorkSchedule(userId),
      getOrgHolidayDays(from, today),
      getAiPrefs(userId),
    ])
  if (!joinedOn) return null

  const orgHolidays = new Set(companyHolidays)
  const coverage = computeCoverage({
    from,
    to,
    loggedDays: new Set(loggedDays),
    // APPROVED ONLY, deliberately. A pending absence exempts nothing, so
    // nobody can lower their own denominator by typing.
    exemptDays: absenceDays(approved, from, to),
    // `isMercantileHoliday` is the rule working-days.ts defaults to — the
    // gazette lists that actually close the office, not every gazetted day —
    // and company holidays compose on top of it through the same callback, so
    // a studio shutdown needs no deploy and no second definition of "holiday".
    // A membership test against LK_HOLIDAYS here used to be exactly that
    // second definition, and it excused the bank closing days.
    isHoliday: (iso) => isMercantileHoliday(iso) || orgHolidays.has(iso),
    patternFor: (iso) => patternForDay(schedule, iso),
    joinedOn,
    today,
  })

  // A day covered by a pending absence has been dealt with, so it leaves the
  // gap list — but coverage still counts it missing, which is exactly why the
  // second group below says so out loud instead of letting it disappear.
  const filedDays = absenceDays(pending, from, to)
  const gaps = coverage.days
    .filter((day) => day.status === 'missing' && !filedDays.has(day.day))
    // The most recent MAX_BACKFILL_DAYS, oldest first — the same cap
    // missing-days.ts applied, for the same reason: an unclearable backlog is
    // indistinguishable from disengagement.
    .slice(-MAX_BACKFILL_DAYS)

  if (gaps.length === 0 && pending.length === 0) return null

  // The same check createAbsence makes, so the control appears exactly when
  // the action would accept it — a stakeholder or auditor is not offered a
  // button whose only possible answer is "Not allowed".
  const canDeclare = actor !== null && can(actor, 'absence.create', { ownerId: actor.id })
  // What a new absence could clash with. The server checks this again against
  // every row; this set is only what the panel loaded, and exists so the
  // common clash can be named before the roundtrip.
  const filed: FiledAbsence[] = [
    ...pending.map((row) => ({
      startDate: row.startDate,
      endDate: row.endDate,
      kind: row.kind,
      status: 'pending' as const,
    })),
    ...approved.map((row) => ({
      startDate: row.startDate,
      endDate: row.endDate,
      kind: row.kind,
      status: 'approved' as const,
    })),
  ]
  // Every day in the window that is a working day for this person, whatever
  // its status — today's included, so declaring leave for today is not
  // mistaken for a no-op. A range containing none of them exempts nothing.
  const owedDays = coverage.days.filter((day) => day.fraction > 0).map((day) => day.day)

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-4">
      {gaps.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-sm font-semibold">
              {gaps.length === 1
                ? '1 earlier day has no entry'
                : `${gaps.length} earlier days have no entry`}
            </h2>
            {/* How the days are counted is stated under the page header, so it
                is not repeated here. */}
            <p className="text-2xs text-muted-foreground">
              Fill in the ones you worked.
              {canDeclare ? (
                <>
                  {' '}
                  If you were not working — leave, sick, training, a day on another project —
                  say so with{' '}
                  <span className="font-medium text-foreground">Not a working day</span> rather
                  than writing an entry for work that did not happen.
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {gaps.map(({ day, fraction }) => (
              <div key={day} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="flex items-baseline gap-2 font-mono text-xs tabular-nums text-muted-foreground">
                    {format(new Date(`${day}T12:00:00`), 'EEEE, MMMM d')}
                    {/* The fraction coverage already worked out for this
                        person, not the studio default: the percentage means
                        "of what I planned", so a half day has to be named or
                        a full Saturday reads as an under-delivered weekday. */}
                    {fraction === 0.5 ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-sans text-2xs font-medium text-foreground">
                        Half day
                      </span>
                    ) : null}
                  </h3>
                  {canDeclare ? (
                    <DeclareAbsenceDialog
                      day={day}
                      filed={filed}
                      owedDays={owedDays}
                      knownFrom={from}
                      knownTo={to}
                    />
                  ) : null}
                </div>
                {/* Draft with AI reads that day's own activity, so a forgotten
                    Tuesday is still recoverable from what LogPup saw. */}
                <WorklogForm day={day} initial={null} aiDraftEnabled={aiPrefs['worklog-draft'].enabled} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-sm font-semibold">Filed, waiting on approval</h2>
            <p className="text-2xs text-muted-foreground">
              Waiting on approval — a day still counts as unlogged until it&rsquo;s approved. It
              left the list above because you have dealt with it, not because it has stopped
              counting.
            </p>
          </div>
          <PendingAbsenceList absences={pending} />
        </div>
      ) : null}
    </section>
  )
}

/**
 * One ISO day, `days` steps away. Anchored at midday for the same reason
 * worklog-day.ts and coverage.ts are: at ±05:30 no other hour survives a step
 * across a date boundary intact. Calendar arithmetic only — which days are
 * working days is decided in working-days.ts and nowhere else.
 */
function shiftDay(iso: string, days: number): string {
  const cursor = new Date(`${iso}T12:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return cursor.toISOString().slice(0, 10)
}

/**
 * Every day an absence covers that falls inside the half-open window
 * `[from, to)`.
 *
 * An absence's own bounds are INCLUSIVE on both ends — they are dates a person
 * stated in words — so the two conventions are clipped against each other in
 * exactly one place rather than wherever a day could be gained or lost.
 */
function absenceDays(ranges: readonly MyAbsence[], from: string, to: string): Set<string> {
  const days = new Set<string>()
  for (const range of ranges) {
    let day = range.startDate < from ? from : range.startDate
    for (; day <= range.endDate && day < to; day = shiftDay(day, 1)) days.add(day)
  }
  return days
}

async function TodayEntry({ userId, today }: { userId: string; today: string }) {
  const [rows, aiPrefs] = await Promise.all([getMyWorklogs(userId, 1), getAiPrefs(userId)])
  const todayRow = rows.find((row) => row.day === today) ?? null
  return (
    <WorklogForm
      day={today}
      initial={todayRow ? { percent: todayRow.percent, note: todayRow.note } : null}
      aiDraftEnabled={aiPrefs['worklog-draft'].enabled}
    />
  )
}

/**
 * What each coverage status says on a row.
 *
 * `missing` is the ONLY one that gets to say "Not logged". That phrase used to
 * be printed against every dayless row in the window, so a fortnight read as
 * thirteen failures including both Saturdays and both Sundays — the page
 * accusing someone of missing days nobody expected them to work. The
 * distinctions come from coverage.ts, which already draws them for the panel
 * directly above this list; the two used to disagree about the same Sunday
 * twelve inches apart.
 */
const DAY_STATE: Record<CoverageStatus, { label: string; tone: string } | null> = {
  logged: null, // renders its percentage and note instead
  missing: { label: 'Not logged', tone: 'text-muted-foreground' },
  exempt: { label: 'Approved leave', tone: 'text-muted-foreground/70' },
  off: { label: 'Not a working day', tone: 'text-muted-foreground/70' },
  'not-yet-due': { label: 'Today — not due yet', tone: 'text-muted-foreground/70' },
  'not-required': { label: 'Not required for your seat', tone: 'text-muted-foreground/70' },
}

async function MyHistory({ userId, today }: { userId: string; today: string }) {
  const days = worklogDaysBack(MY_DAYS, new Date(`${today}T12:00:00Z`))
  const from = days[days.length - 1]

  /* The same five inputs the catch-up panel above uses, fetched again here
     because each panel is its own Suspense boundary — but computed through the
     SAME function, which is the part that matters: two panels on one screen
     must not hold two opinions about whether a Sunday was owed. */
  const [rows, schedule, approved, orgHolidayDays, joinedOn] = await Promise.all([
    getMyWorklogs(userId, MY_DAYS),
    getMyWorkSchedule(userId),
    getMyApprovedAbsences(userId, from, today),
    getOrgHolidayDays(from, today),
    getUserJoinDay(userId),
  ])

  const byDay = new Map(rows.map((row) => [row.day, row]))
  const orgHolidays = new Set(orgHolidayDays)

  const coverage = computeCoverage({
    from,
    to: today,
    loggedDays: new Set(rows.map((row) => row.day)),
    // Approved only — a pending absence exempts nothing, the same rule the
    // catch-up panel states out loud.
    exemptDays: absenceDays(approved, from, today),
    isHoliday: (iso) => isMercantileHoliday(iso) || orgHolidays.has(iso),
    patternFor: (iso) => patternForDay(schedule, iso),
    joinedOn: joinedOn ?? from,
    today,
  })
  const statusByDay = new Map(coverage.days.map((day) => [day.day, day]))

  /* Owed day-fractions, not a count of rows. Saturday is half a day, so
     counting logged rows over a flat fourteen both inflated the denominator
     with days nobody owed and treated a Saturday as a whole one. `expected`
     already excludes weekends, holidays, approved leave and days before you
     joined, and the invariant expected === logged + missing is what makes the
     figure below mean anything at all. */
  const { expected, logged: loggedFraction } = coverage
  const coveragePct = expected > 0 ? Math.round((loggedFraction / expected) * 100) : null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">Your last {MY_DAYS} days</h2>
        {/* Days you owed, and how many of them you filed — not "averaging N%
            on the days you logged", which computed a mean over whatever
            happened to be there. One entry made that read "averaging 50%",
            a statistic from a sample of one. */}
        <p className="text-2xs text-muted-foreground">
          {expected === 0 ? (
            'No days owed in this window'
          ) : (
            <>
              <span className="font-mono tabular-nums text-foreground">{coveragePct}%</span>
              {' of the days you owed'}
            </>
          )}
        </p>
      </div>

      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {days.map((day) => {
          const row = byDay.get(day)
          const status = statusByDay.get(day)?.status ?? 'missing'
          const state = DAY_STATE[status]
          /* A Saturday is half a day and says so. Without it the row reads as
             a full working day somebody only half-filled. */
          const half = statusByDay.get(day)?.fraction === 0.5
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
                <span className={cn('min-w-0 flex-1 text-sm', state?.tone)}>{state?.label}</span>
              )}
              {half ? (
                <span className="shrink-0 font-mono text-2xs text-muted-foreground/70 uppercase">
                  Half day
                </span>
              ) : null}
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
