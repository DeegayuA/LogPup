import { Suspense } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { PawPrint, TriangleAlert } from 'lucide-react'
import { getSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import { getLkHoliday, excusesWork, LK_TIMEZONE } from '@/lib/lk-holidays'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { loadActor } from '@/features/auth/actor'
import { can, isAdminRole } from '@/features/auth/capabilities'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { HelpDetail, HelpNote } from '@/components/shared/help-note'
import { DayPanel } from '@/features/worklog/components/day-panel'
import {
  getMyEntryDaysInRange,
  listDayEntriesForDisplay,
  listLoggableTasks,
} from '@/features/worklog/entry-queries'
import { scheduledMinutesForFraction } from '@/features/worklog/schedules'
import {
  WorklogCalendar,
  shiftMonth,
  type CalendarDayFacts,
} from '@/features/worklog/components/worklog-calendar'
import { MonthSummary } from '@/features/worklog/components/month-summary'
import { CatchUpPanel, type CatchUpGap } from '@/features/worklog/components/catch-up-panel'
import {
  ABSENCE_KIND_LABELS,
  DeclareAbsenceDialog,
  type FiledAbsence,
} from '@/features/worklog/components/declare-absence-dialog'
import { PendingAbsenceList } from '@/features/worklog/components/pending-absence-list'
import {
  DAY_STATE_LABEL,
  classifyDay,
  dayStateText,
  isHalfDay,
  loggedTone,
  DAY_STATE_CLASS,
} from '@/features/worklog/day-state'
import { splitNoteAppTags, type AppRef } from '@/features/worklog/note-app-tags'
import {
  countMyWorklogDays,
  getMyApprovedAbsences,
  getMyAssignedApps,
  getMyDecidedAbsences,
  getMyPendingAbsences,
  getMyWorkSchedule,
  getMyWorklogsInRange,
  getTeamApprovedAbsences,
  getTeamRoster,
  getTeamWorklogs,
  listAppTagTargets,
  getUserJoinDay,
} from '@/features/worklog/queries'
import { computeCoverage, formatCoverage } from '@/features/worklog/coverage'
import { buildHolidayCalendar, closesTheStudio } from '@/features/worklog/holiday-listing'
import { listOrgHolidays, type OrgHolidayRow } from '@/features/worklog/org-holiday-queries'
import { absenceDays } from '@/features/worklog/absence-days'
import { patternForDay } from '@/features/worklog/schedules'
import { MAX_BACKFILL_DAYS } from '@/features/worklog/missing-days'
import { WORK_DAY_PATTERN, resolveWorkDay, worklogDaysBack, isFutureWorkDay } from '@/features/worklog/worklog-day'
import { getAiPrefs } from '@/features/gemini/prefs'

export const metadata = { title: 'Work log' }

/** How far the admin team view looks back. */
const TEAM_DAYS = 7

/**
 * How far back the catch-up panel and the streak look — the same safety bound
 * missing-days.ts walked. Long enough to still find MAX_BACKFILL_DAYS owed
 * days on the far side of a long absence, short enough that the window is a
 * fixed cost however long somebody has been here.
 */
const LOOKBACK_WINDOW_DAYS = 120

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * "What did I do each day, and how much of what I planned did I get through?"
 *
 * CALENDAR-FIRST since 2026-08-20 (see the UI-intelligence redesign spec):
 * the month is the page's heart — every day painted with the shared
 * day-state vocabulary — and clicking any own past day opens that day's form
 * beside it. That closes the oldest gap this page had: a logged earlier day
 * (typo, wrong percent) had NO edit path anywhere in the app, even though
 * `upsertDailyWorklog` accepted the correction all along.
 *
 * One entry per person per day. The percentage is self-scored against the
 * person's own plan rather than derived from closed tickets, so a day of
 * meetings, review or debugging is not silently reported as zero — see
 * dailyWorklogs in src/db/schema.ts for why this is not sprintCheckins.
 * DAYS, NEVER HOURS, everywhere on this page: percent-of-plan multiplied
 * into hours would be a fabricated timesheet.
 *
 * The month and the selected day live in the URL (?month=YYYY-MM&day=…), so
 * any view of this page is linkable and the calendar needs no client state.
 *
 * Every zone below fetches for itself inside its own try/catch: one failed
 * Neon read costs its card, not the page. The route-level error.tsx is the
 * backstop, not the plan.
 */
export default async function WorklogPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [session, raw] = await Promise.all([getSession(), props.searchParams])
  if (!session?.user) return null

  const today = resolveWorkDay(new Date())
  const isAdmin = isAdminRole(session.user.role)

  // Hand-edited params degrade to the defaults, never to an error page.
  const rawDay = firstParam(raw.day)
  const rawMonth = firstParam(raw.month)
  const selectedDay =
    rawDay && WORK_DAY_PATTERN.test(rawDay) && isRealDay(rawDay) && rawDay <= today
      ? rawDay
      : today
  const month = rawMonth && MONTH_PATTERN.test(rawMonth) ? rawMonth : selectedDay.slice(0, 7)
  const retryHref = `/worklog?month=${month}&day=${selectedDay}`

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
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

      <div className="flex flex-col gap-3">
        <PageHeader
          title="Daily Work Log"
          description={`${format(new Date(`${today}T12:00:00`), 'EEEE, MMMM d, yyyy')} — one line about your day, and how far you got.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-2xs font-medium text-primary">
                🇱🇰 Asia/Colombo (UTC+05:30)
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 font-mono text-2xs text-muted-foreground">
                Shop &amp; Office Standard
              </span>
            </div>
          }
        />
        <HelpDetail summary="How days are counted • Sri Lanka Studio Policy & Counting Rules">
          <div className="grid gap-3 sm:grid-cols-3 pt-1">
            <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/20 p-2.5">
              <span className="font-heading text-2xs font-bold text-foreground">
                Working Days &amp; Weekends
              </span>
              <span className="text-2xs text-muted-foreground leading-relaxed">
                <strong>Mon &ndash; Fri</strong> are 100% full sprint days. <strong>Saturday</strong> is a 50% half-day (4h). <strong>Sunday</strong> is standard studio rest.
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/20 p-2.5">
              <span className="font-heading text-2xs font-bold text-foreground">
                Mercantile &amp; Poya Holidays
              </span>
              <span className="text-2xs text-muted-foreground leading-relaxed">
                Gazetted Full Moon Poya days and Mercantile holidays are official studio rest days (0% expected).
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-muted/20 p-2.5">
              <span className="font-heading text-2xs font-bold text-foreground">
                Catch-Up &amp; Privacy
              </span>
              <span className="text-2xs text-muted-foreground leading-relaxed">
                Unlogged owed days wait in the catch-up queue (up to {MAX_BACKFILL_DAYS} days). Only you can log your days.
              </span>
            </div>
          </div>
        </HelpDetail>
      </div>

      <Suspense fallback={<SummarySkeleton />}>
        <SummaryZone userId={session.user.id} month={month} today={today} retryHref={retryHref} />
      </Suspense>

      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarZone
          userId={session.user.id}
          month={month}
          selectedDay={selectedDay}
          today={today}
          retryHref={retryHref}
        />
      </Suspense>

      <Suspense fallback={<CatchUpSkeleton />}>
        <CatchUpZone userId={session.user.id} today={today} retryHref={retryHref} />
      </Suspense>

      {isAdmin ? (
        <Suspense fallback={<TeamSkeleton />}>
          <TeamZone today={today} viewerId={session.user.id} retryHref={retryHref} />
        </Suspense>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared day plumbing
// ---------------------------------------------------------------------------

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** '2026-02-31' matches the day pattern and is not a day. */
function isRealDay(iso: string): boolean {
  const date = new Date(`${iso}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso
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
 * ISO day → holiday name for every day in `[from, to]` the studio is
 * actually shut: gazetted mercantile days plus in-force company rows, both
 * through `closesTheStudio` — THE composition the spec names, and the same
 * question coverage asks, so the calendar cannot paint a day the denominator
 * still counts. Notably NOT `getOrgHolidayDays`, which would count a revoked
 * company row as closed.
 */
function closedStudioDays(orgRows: OrgHolidayRow[], from: string, to: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of buildHolidayCalendar(orgRows)) {
    if (row.day < from || row.day > to) continue
    if (!closesTheStudio(row)) continue
    if (!map.has(row.day)) map.set(row.day, row.name)
  }
  return map
}

const minIso = (a: string, b: string) => (a < b ? a : b)
const maxIso = (a: string, b: string) => (a > b ? a : b)

// ---------------------------------------------------------------------------
// Summary zone — the month in four numbers
// ---------------------------------------------------------------------------

async function SummaryZone({
  userId,
  month,
  today,
  retryHref,
}: {
  userId: string
  month: string
  today: string
  retryHref: string
}) {
  const monthStart = `${month}-01`
  const nextMonthStart = `${shiftMonth(month, 1)}-01`
  const monthEnd = shiftDay(nextMonthStart, -1)
  const streakFrom = shiftDay(today, -LOOKBACK_WINDOW_DAYS)
  const streakTo = shiftDay(today, 1)
  // One window covering both the viewed month and the streak's lookback.
  const from = minIso(monthStart, streakFrom)
  const to = maxIso(monthEnd, today)
  const toExclusive = maxIso(nextMonthStart, streakTo)

  /* All fetching and derivation lives in here so ONE try/catch covers it —
     and no JSX does: the render below happens after the catch has already
     decided between data and the error card (same shape as admin/bugs). */
  const load = async () => {
    const [joinedOn, everLogged, rows, approved, schedule, orgRows] = await Promise.all([
      getUserJoinDay(userId),
      countMyWorklogDays(userId),
      getMyWorklogsInRange(userId, from, to),
      getMyApprovedAbsences(userId, from, to),
      getMyWorkSchedule(userId),
      listOrgHolidays(),
    ])
    if (!joinedOn || everLogged === 0) {
      return { joinedOn, everLogged, summary: null }
    }

    const closed = closedStudioDays(orgRows, from, to)
    const isHoliday = (iso: string) => closed.has(iso)
    const loggedDays = new Set(rows.map((row) => row.day))
    const exemptDays = absenceDays(approved, from, toExclusive)
    const patternFor = (iso: string) => patternForDay(schedule, iso)

    /* The whole month's expectation, whatever today is: computeCoverage with
       a synthetic `today` past the month's end makes every day due, so
       `expected` sums the month's owed fractions — working days minus
       studio-closing holidays minus approved leave, halves kept as halves.
       Not a private re-derivation: same function, same inputs, one opinion. */
    const wholeMonth = computeCoverage({
      from: monthStart,
      to: nextMonthStart,
      loggedDays,
      exemptDays,
      isHoliday,
      patternFor,
      joinedOn,
      today: nextMonthStart,
    })

    /* The same window against the REAL today: days ahead fall out as
       not-yet-due, so this is "of what was due so far, how much is filed". */
    const soFar = computeCoverage({
      from: monthStart,
      to: nextMonthStart,
      loggedDays,
      exemptDays,
      isHoliday,
      patternFor,
      joinedOn,
      today,
    })
    const coveragePct =
      soFar.expected > 0 ? Math.round((soFar.logged / soFar.expected) * 100) : null

    /* Streak: consecutive owed days answered, walking back from today.
       Non-owed days — weekends, holidays, approved leave — are stepped over
       rather than breaking the run, and today breaks nothing while it is
       still in progress. Capped by the lookback window, which at 120 days is
       a boast, not a limit. */
    const streakCoverage = computeCoverage({
      from: streakFrom,
      to: streakTo,
      loggedDays,
      exemptDays,
      isHoliday,
      patternFor,
      joinedOn,
      today,
    })
    let streak = 0
    for (let i = streakCoverage.days.length - 1; i >= 0; i -= 1) {
      const day = streakCoverage.days[i]
      if (day.status === 'logged') {
        streak += 1
        continue
      }
      if (day.status === 'missing') break
      // off / exempt / not-yet-due / not-required: skip without breaking.
    }

    const loggedCount = rows.filter((row) => row.day >= monthStart && row.day <= monthEnd).length

    return {
      joinedOn,
      everLogged,
      summary: {
        expected: wholeMonth.expected,
        loggedCount,
        coveragePct,
        coverageDetail: formatCoverage(soFar),
        streak,
      },
    }
  }

  let data: Awaited<ReturnType<typeof load>> | null = null
  try {
    data = await load()
  } catch (cause) {
    console.error('[worklog] month summary failed', cause)
  }
  if (!data) return <ZoneError title="The month summary could not be read." retryHref={retryHref} />
  if (!data.joinedOn) return null

  // First run: teach the page instead of showing four zeroes.
  if (data.everLogged === 0 || !data.summary) {
    return (
      <EmptyState
        icon={PawPrint}
        title="Log your first day — it takes 20 seconds"
        description="Score how much of what you planned you got through, write one line about the day (or let AI draft it from your own activity), and save. The calendar fills in as you go."
        action={<Button render={<a href="#day-panel" />}>Log today</Button>}
        className="rounded-xl border border-dashed"
      />
    )
  }

  return (
    <MonthSummary
      monthLabel={format(new Date(`${monthStart}T12:00:00`), 'MMMM')}
      expected={data.summary.expected}
      loggedCount={data.summary.loggedCount}
      coveragePct={data.summary.coveragePct}
      coverageDetail={data.summary.coverageDetail}
      streak={data.summary.streak}
    />
  )
}

// ---------------------------------------------------------------------------
// Calendar zone — the month grid and the selected day's panel
// ---------------------------------------------------------------------------

async function CalendarZone({
  userId,
  month,
  selectedDay,
  today,
  retryHref,
}: {
  userId: string
  month: string
  selectedDay: string
  today: string
  retryHref: string
}) {
  const monthStart = `${month}-01`
  const nextMonthStart = `${shiftMonth(month, 1)}-01`
  const monthEnd = shiftDay(nextMonthStart, -1)
  // The selected day can sit outside the viewed month (paging away keeps the
  // panel open); the fetch window covers both.
  const from = minIso(monthStart, selectedDay)
  const to = maxIso(monthEnd, selectedDay)

  /* Fetching and derivation only — the JSX below renders after the catch has
     already decided between data and the error card. */
  const load = async () => {
    const [
      actor,
      joinedOn,
      rows,
      hourDays,
      approved,
      pending,
      schedule,
      orgRows,
      aiPrefs,
      assignedApps,
    ] = await Promise.all([
        loadActor(),
        getUserJoinDay(userId),
        getMyWorklogsInRange(userId, from, to),
        // The OTHER half of "did I log this day". Batched with the rest, one
        // distinct-day read over the same window the scores are read over.
        getMyEntryDaysInRange(userId, from, to),
        getMyApprovedAbsences(userId, from, to),
        getMyPendingAbsences(userId),
        getMyWorkSchedule(userId),
        listOrgHolidays(),
        getAiPrefs(userId),
        getMyAssignedApps(userId),
      ])

    const closed = closedStudioDays(orgRows, from, to)
    const absent = absenceDays(approved, from, shiftDay(to, 1))
    const facts: CalendarDayFacts = {
      loggedPercent: Object.fromEntries(
        rows
          .filter((row) => row.day >= monthStart && row.day <= monthEnd)
          .map((row) => [row.day, row.percent]),
      ),
      absentDays: absent,
      closedDays: Object.fromEntries(closed),
      hourDays,
    }

    // The selected day's own facts, for the panel's heading and form.
    const selectedRow = rows.find((row) => row.day === selectedDay) ?? null
    const selectedState = classifyDay({
      iso: selectedDay,
      percent: selectedRow?.percent,
      hasHours: hourDays.has(selectedDay),
      absent: absent.has(selectedDay),
      holiday: closed.has(selectedDay),
      today,
      joinDay: joinedOn,
    })
    const selectedHalf = isHalfDay(selectedDay, closed.has(selectedDay))
    const selectedHolidayName = closed.get(selectedDay) ?? null

    // The same check createAbsence makes, so the control appears exactly when
    // the action would accept it. loadActor is null for a deactivated
    // account — the page still shows their own record, minus the button.
    const canDeclare = actor !== null && can(actor, 'absence.create', { ownerId: actor.id })
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
    /* Days in the viewed month the studio expected work on — fraction > 0,
       schedule-aware via coverage, whatever each day's status. The dialog
       uses these to refuse a filing that would exempt nothing. */
    const monthCoverage = computeCoverage({
      from: monthStart,
      to: nextMonthStart,
      loggedDays: new Set(rows.map((row) => row.day)),
      exemptDays: absent,
      isHoliday: (iso) => closed.has(iso),
      patternFor: (iso) => patternForDay(schedule, iso),
      joinedOn: joinedOn ?? monthStart,
      today: nextMonthStart,
    })
    const owedDays = monthCoverage.days.filter((day) => day.fraction > 0).map((day) => day.day)

    // The selected day's logged hours. Fetched here rather than in a nested
    // Suspense: it is one indexed read on (user_id, day) and the panel it
    // feeds sits beside the form, so a second boundary would flash an empty
    // card next to a full one.
    // Batched with the task picker's list: both feed the same panel, and the
    // task read does not depend on which day is selected — a task entry names
    // work, not a date. Awaiting them in sequence would add a round trip to
    // every day you page to for a list that does not change between them.
    const [dayEntries, loggableTasks] = await Promise.all([
      listDayEntriesForDisplay(userId, selectedDay),
      listLoggableTasks(userId),
    ])

    // Scheduled minutes for the selected day, taken from the coverage pass
    // already computed above rather than re-derived: that fraction is
    // schedule-aware AND holiday-folded, so a closed day reads as 0 here for
    // the same reason it does everywhere else. A day outside the month window
    // yields null, which the card renders as "cannot say" rather than
    // assuming a working day — there is deliberately no ?? 480 in this repo.
    const selectedFraction =
      monthCoverage.days.find((d) => d.day === selectedDay)?.fraction ?? null
    const scheduledMinutes =
      selectedFraction === null ? null : scheduledMinutesForFraction(selectedFraction)
    const canLogHours = !isFutureWorkDay(selectedDay, new Date())

    return {
      dayEntries,
      loggableTasks,
      scheduledMinutes,
      canLogHours,
      // A SEPARATE pref from 'worklog-draft': that one drafts the day's NOTE,
      // this one proposes hours rows. Somebody may reasonably want prose help
      // and not want a model estimating durations they will be paid against,
      // so the two switches stay independent.
      entriesAiEnabled: aiPrefs['worklog-entries-draft'].enabled,
      joinedOn,
      facts,
      selectedRow,
      selectedState,
      selectedHalf,
      selectedHolidayName,
      canDeclare,
      filed,
      owedDays,
      aiDraftEnabled: aiPrefs['worklog-draft'].enabled,
      assignedApps,
    }
  }

  let data: Awaited<ReturnType<typeof load>> | null = null
  try {
    data = await load()
  } catch (cause) {
    console.error('[worklog] calendar failed', cause)
  }
  if (!data) return <ZoneError title="The calendar could not be read." retryHref={retryHref} />

  const {
    dayEntries,
    loggableTasks,
    scheduledMinutes,
    canLogHours,
    entriesAiEnabled,
    joinedOn,
    facts,
    selectedRow,
    selectedState,
    selectedHalf,
    selectedHolidayName,
    canDeclare,
    filed,
    owedDays,
    aiDraftEnabled,
    assignedApps,
  } = data

  const selectedLkHoliday = getLkHoliday(new Date(`${selectedDay}T12:00:00Z`), LK_TIMEZONE)
  const isSelectedMercantile = selectedLkHoliday
    ? excusesWork(selectedLkHoliday.categories)
    : Boolean(selectedHolidayName)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <WorklogCalendar
        month={month}
        today={today}
        joinDay={joinedOn}
        selectedDay={selectedDay}
        facts={facts}
      />

      <section
        id="day-panel"
        aria-label={`Selected day, ${format(new Date(`${selectedDay}T12:00:00`), 'EEEE, MMMM d, yyyy')}`}
        className="flex min-w-0 flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-bold text-foreground">
              {format(new Date(`${selectedDay}T12:00:00`), 'EEEE, MMMM d')}
            </h2>
            {selectedHalf ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs font-semibold text-foreground">
                Half day (50%)
              </span>
            ) : null}
            {selectedState === 'holiday' ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-chart-1/40 bg-chart-1/15 px-2.5 py-0.5 font-sans text-2xs font-semibold text-chart-1">
                <span>🌕 {selectedHolidayName ?? 'Holiday'}</span>
                <span className="rounded bg-chart-1/25 px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase tracking-wider">
                  {isSelectedMercantile ? 'Mercantile (Studio Off)' : 'Public / Bank'}
                </span>
              </span>
            ) : selectedState === 'absence' || selectedState === 'off' ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-sans text-2xs font-medium text-muted-foreground">
                {DAY_STATE_LABEL[selectedState]}
              </span>
            ) : null}
          </div>

          {canDeclare && (selectedState === 'owed' || selectedState === 'partial') ? (
            <DeclareAbsenceDialog
              day={selectedDay}
              filed={filed}
              owedDays={owedDays}
              knownFrom={monthStart}
              knownTo={nextMonthStart}
            />
          ) : null}
        </div>

        {selectedState === 'holiday' || selectedState === 'off' || selectedState === 'absence' ? (
          <HelpNote>
            Nobody expected work from you this day — log it only if you actually worked. It
            counts as extra, never against you.
          </HelpNote>
        ) : null}

        {/* THE HALF-LOGGED DAY, SAID OUT LOUD. Hours and the score are written
            by two actions to two tables, and every "is this day done?" answer
            on this page reads only the score — so this day counts as owed on
            the calendar, in coverage and in the ledger, despite the hours
            sitting right there in the panel below. That was true before and is
            still true; the only thing that was missing was anybody saying it.
            Server-rendered, so it does not depend on an AI pref being on. */}
        {selectedState === 'partial' ? (
          <HelpNote>
            Your hours for this day are recorded — the day still needs a score. They are two
            separate answers: the hours say where the time went, the score says how much of
            what you planned you got through. Score it below and the day is complete.
          </HelpNote>
        ) : null}

        {/* One panel, not three cards: the score, the note and the hours are
            three answers to one question, and they now share a single
            "Fill my day" rather than carrying two overlapping AI buttons. */}
        <DayPanel
          day={selectedDay}
          initial={selectedRow ? { percent: selectedRow.percent, note: selectedRow.note } : null}
          entries={dayEntries}
          tasks={loggableTasks}
          scheduledMinutes={scheduledMinutes}
          assignedApps={assignedApps}
          canEdit={canLogHours}
          noteAiEnabled={aiDraftEnabled}
          entriesAiEnabled={entriesAiEnabled}
        />

      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Catch-up zone — owed days, and filings waiting on approval
// ---------------------------------------------------------------------------

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
 * Which days are owed comes from `computeCoverage`: approved leave, company
 * holidays and a person's own work schedule, each as a status per day, so ONE
 * filter (`status === 'missing'`) drops exempt, off and not-yet-due days at
 * once, today's own day included, by rule rather than by a special case.
 *
 * Renders nothing when both groups are empty — a permanently-present panel
 * showing zero is noise that teaches people to ignore the area where the real
 * prompt appears. Deliberately not styled as a warning: people take leave and
 * spend days on other work, and a blank day is not a fault.
 */
async function CatchUpZone({
  userId,
  today,
  retryHref,
}: {
  userId: string
  today: string
  retryHref: string
}) {
  // Half-open [from, to), and `to` is tomorrow so today sits INSIDE the window
  // and falls out of the gap list as `not-yet-due` — the same rule that drops
  // a Sunday, rather than a special case that has to be remembered.
  const from = shiftDay(today, -LOOKBACK_WINDOW_DAYS)
  const to = shiftDay(today, 1)

  const load = async () => {
    const [
      actor,
      joinedOn,
      rows,
      hourDays,
      pending,
      decided,
      approved,
      schedule,
      orgRows,
      aiPrefs,
      assignedApps,
    ] = await Promise.all([
        loadActor(),
        getUserJoinDay(userId),
        getMyWorklogsInRange(userId, from, today),
        getMyEntryDaysInRange(userId, from, today),
        getMyPendingAbsences(userId),
        // Decided absences are bounded by DECISION time, not by the calendar
        // window: a refusal is news about the person, and scoping it to the
        // viewed month is how a rejection for next month goes unseen.
        getMyDecidedAbsences(userId, new Date(`${from}T00:00:00Z`)),
        getMyApprovedAbsences(userId, from, today),
        getMyWorkSchedule(userId),
        listOrgHolidays(),
        getAiPrefs(userId),
        getMyAssignedApps(userId),
      ])
    if (!joinedOn) return null

    const closed = closedStudioDays(orgRows, from, today)
    const coverage = computeCoverage({
      from,
      to,
      loggedDays: new Set(rows.map((row) => row.day)),
      // APPROVED ONLY, deliberately. A pending absence exempts nothing, so
      // nobody can lower their own denominator by typing.
      exemptDays: absenceDays(approved, from, to),
      isHoliday: (iso) => closed.has(iso),
      patternFor: (iso) => patternForDay(schedule, iso),
      joinedOn,
      today,
    })

    // A day covered by a pending absence has been dealt with, so it leaves
    // the gap list — but coverage still counts it missing, which is exactly
    // why the second group below says so out loud instead of letting it
    // disappear.
    const filedDays = absenceDays(pending, from, to)
    const gaps: CatchUpGap[] = coverage.days
      .filter((day) => day.status === 'missing' && !filedDays.has(day.day))
      // The most recent MAX_BACKFILL_DAYS, oldest first — an unclearable
      // backlog is indistinguishable from disengagement.
      .slice(-MAX_BACKFILL_DAYS)
      .map(({ day, fraction }) => ({ day, fraction, hasHours: hourDays.has(day) }))

    const canDeclare = actor !== null && can(actor, 'absence.create', { ownerId: actor.id })
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

    return {
      gaps,
      pending,
      decided,
      canDeclare,
      filed,
      owedDays,
      aiDraftEnabled: aiPrefs['worklog-draft'].enabled,
      assignedApps,
    }
  }

  let data: Awaited<ReturnType<typeof load>> | undefined
  try {
    data = await load()
  } catch (cause) {
    console.error('[worklog] catch-up failed', cause)
  }
  if (data === undefined)
    return <ZoneError title="The catch-up list could not be read." retryHref={retryHref} />
  if (data === null) return null

  const { gaps, pending, decided, canDeclare, filed, owedDays, aiDraftEnabled, assignedApps } =
    data
  // A decision keeps this section alive on its own. Somebody with no gaps and
  // nothing pending still has to be told their leave was refused.
  if (gaps.length === 0 && pending.length === 0 && decided.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      {gaps.length > 0 ? (
        <CatchUpPanel
          gaps={gaps}
          filed={filed}
          owedDays={owedDays}
          knownFrom={from}
          knownTo={to}
          canDeclare={canDeclare}
          aiDraftEnabled={aiDraftEnabled}
          assignedApps={assignedApps}
        />
      ) : null}

      {pending.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-5 shadow-xs backdrop-blur-sm">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-sm font-semibold">Filed, waiting on approval</h2>
            <p className="text-2xs text-muted-foreground">
              A day still counts as unlogged until it&rsquo;s approved. It left the list above
              because you have dealt with it, not because it has stopped counting.
            </p>
          </div>
          <PendingAbsenceList absences={pending} />
        </div>
      ) : null}

      {/* THE DECISION REACHES THE PERSON WHO FILED IT.
          review() has always written reviewNote (absence-actions.ts), and
          until now nothing in the app read it. A refusal arrived as the
          request quietly no longer being listed — so somebody could take
          leave they had been refused, or chase a decision already made and
          explained. The reviewer's own sentence is the whole point. */}
      {decided.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-5 shadow-xs backdrop-blur-sm">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-sm font-semibold">Decided</h2>
            <p className="text-2xs text-muted-foreground">
              What came back on the time off you filed. An approved range stops counting
              against you; a refused one does not, so those days are still yours to log.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {decided.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 rounded-xl border border-border/50 bg-background/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-sans text-2xs font-semibold',
                      row.status === 'approved'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-destructive/15 text-destructive',
                    )}
                  >
                    {row.status === 'approved' ? 'Approved' : 'Not approved'}
                  </span>
                  <span className="font-heading text-xs font-semibold">
                    {ABSENCE_KIND_LABELS[row.kind]}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground tabular-nums">
                    {row.startDate === row.endDate
                      ? format(new Date(`${row.startDate}T12:00:00`), 'EEE, MMM d')
                      : `${format(new Date(`${row.startDate}T12:00:00`), 'MMM d')} – ${format(
                          new Date(`${row.endDate}T12:00:00`),
                          'MMM d',
                        )}`}
                  </span>
                </div>
                {/* The reviewer's words, verbatim, never paraphrased into a
                    status. "Not approved" without the reason is the same dead
                    end this section exists to remove. */}
                {row.reviewNote ? (
                  <p className="text-2xs text-muted-foreground">{row.reviewNote}</p>
                ) : row.status === 'rejected' ? (
                  <p className="text-2xs text-muted-foreground italic">
                    No reason was given — ask whoever reviewed it.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Team zone — admins only
// ---------------------------------------------------------------------------

async function TeamZone({
  today,
  viewerId,
  retryHref,
}: {
  today: string
  /**
   * Who is reading. Their OWN row's days link into the editor.
   *
   * Not everybody's: a worklog is a first-person statement and there is no
   * worklog.write.any capability for any seat — capabilities.test.ts asserts
   * the key does not exist. An admin editing somebody's day would be putting
   * words in their mouth in the one record that is meant to be theirs, so the
   * card links to the person instead and the row stays read-only.
   */
  viewerId: string
  retryHref: string
}) {
  const days = worklogDaysBack(TEAM_DAYS, new Date(`${today}T12:00:00Z`))
  const from = days[days.length - 1]
  const strip = [...days].reverse() // chronological, oldest → today

  type Person = {
    userId: string
    name: string
    entries: Map<string, { percent: number; note: string | null }>
  }

  const load = async () => {
    const [roster, rows, teamAbsences, orgRows, apps] = await Promise.all([
      getTeamRoster(),
      getTeamWorklogs(from, today),
      getTeamApprovedAbsences(from, today),
      listOrgHolidays(),
      listAppTagTargets(),
    ])

    const closed = closedStudioDays(orgRows, from, today)

    // THE ROSTER SEEDS THE MAP, not the worklog rows. Built the other way
    // round, a person who logged nothing in the window produced no rows and
    // therefore no card — so the view an admin opens to find who is behind
    // could show everyone EXCEPT the people who are behind. Seeding from the
    // roster means somebody with no logs renders as a full strip of amber
    // squares, which is the news this zone exists to deliver.
    const byUser = new Map<string, Person>(
      roster.map((member) => [
        member.userId,
        { userId: member.userId, name: member.name, entries: new Map() },
      ]),
    )
    for (const row of rows) {
      // A row for somebody NOT on the roster is somebody deactivated or
      // removed since they logged. Their days are not this view's business —
      // it reports on who is expected to log now — so the row is skipped
      // rather than resurrecting a card the people surfaces have dropped.
      const person = byUser.get(row.userId)
      if (!person) continue
      person.entries.set(row.day, { percent: row.percent, note: row.note })
    }
    const people = [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name))

    const absentByUser = new Map<string, Set<string>>()
    for (const range of teamAbsences) {
      const set = absentByUser.get(range.userId) ?? new Set<string>()
      for (const day of absenceDays([range], from, shiftDay(today, 1))) set.add(day)
      absentByUser.set(range.userId, set)
    }

    return { people, absentByUser, closed, apps }
  }

  let data: Awaited<ReturnType<typeof load>> | null = null
  try {
    data = await load()
  } catch (cause) {
    console.error('[worklog] team view failed', cause)
  }
  if (!data) return <ZoneError title="The team view could not be read." retryHref={retryHref} />

  const { people, absentByUser, closed, apps } = data

  return (
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-sm font-semibold">The team, last {TEAM_DAYS} days</h2>
          <p className="text-2xs text-muted-foreground">
            Each person&rsquo;s own account of their day. The percentages are self-scored against
            what each of them planned, so they read as a trend per person rather than a league
            table.
          </p>
        </div>

        {people.length === 0 ? (
          <EmptyState
            title="Nobody is on the roster yet"
            description="This view covers everybody active and approved. Cards appear as soon as somebody is."
            className="rounded-xl border border-dashed"
          />
        ) : (
          /* COLUMNS, NOT A GRID. Every card is a different height — one
             person's four logged days against another's empty strip — and in
             a two-column grid the whole row stretches to the tallest card,
             so a short card leaves a screen-high hole beside a long one. CSS
             columns pack by height instead. break-inside-avoid keeps a card
             from being split across the column boundary. */
          <div className="gap-3 md:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
            {people.map((person) => {
              // A working day this person neither logged nor was away for —
              // the amber squares in the strip. Counted from the same
              // classifier the strip renders, so the number and the squares
              // can never disagree.
              const owed = strip.filter(
                (iso) =>
                  classifyDay({
                    iso,
                    percent: person.entries.get(iso)?.percent,
                    absent: absentByUser.get(person.userId)?.has(iso) ?? false,
                    holiday: closed.has(iso),
                    today,
                  }) === 'owed',
              ).length
              const isSelf = person.userId === viewerId
              return (
              <div
                key={person.userId}
                className={cn(
                  'flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-3',
                  isSelf && 'border-primary/40',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/people/${person.userId}`}
                    className="min-w-0 truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {person.name}
                  </Link>
                  {/* Both halves, because the strip below shows both. "3 days
                      logged" beside three amber squares left the amber ones
                      unnamed, and an unnamed state reads as decoration. */}
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {isSelf ? <span className="text-primary">You · </span> : null}
                    <span className="font-mono tabular-nums">{person.entries.size}</span> logged
                    {owed > 0 ? (
                      <>
                        {' · '}
                        <span className="font-mono tabular-nums text-chart-1">{owed}</span>
                        <span className="text-chart-1"> not logged</span>
                      </>
                    ) : null}
                  </span>
                </div>

                {/* The 7-day strip speaks the calendar's own language — same
                    classifier, same classes — so "what kind of day was that"
                    has one answer on this page. */}
                <ul className="flex gap-1">
                  {strip.map((iso) => {
                    const entry = person.entries.get(iso)
                    const input = {
                      iso,
                      percent: entry?.percent,
                      absent: absentByUser.get(person.userId)?.has(iso) ?? false,
                      holiday: closed.has(iso),
                      today,
                    }
                    const state = classifyDay(input)
                    const half = isHalfDay(iso, closed.has(iso))
                    // Own row only, and never a day that cannot be logged
                    // against — the same rule the calendar's own cells follow.
                    const editable =
                      isSelf && state !== 'future' && state !== 'outside'
                    const paint = (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            'absolute inset-0 flex items-center justify-center rounded-[inherit]',
                            DAY_STATE_CLASS[state],
                            state === 'logged' &&
                              entry !== undefined &&
                              loggedTone(entry.percent),
                            half && 'top-1/2 rounded-t-none',
                          )}
                        >
                          <span className="font-mono text-2xs tabular-nums">
                            {Number(iso.slice(8, 10))}
                          </span>
                        </span>
                        <span className="sr-only">
                          {dayStateText(input)}
                          {editable ? ' — open to edit' : ''}
                        </span>
                      </>
                    )
                    return (
                      <li key={iso} className="relative size-8 overflow-hidden rounded-sm">
                        {editable ? (
                          <Link
                            href={`/worklog?day=${iso}&month=${iso.slice(0, 7)}`}
                            className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {paint}
                          </Link>
                        ) : (
                          paint
                        )}
                      </li>
                    )
                  })}
                </ul>

                <ul className="flex flex-col gap-1.5">
                  {[...person.entries.entries()]
                    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                    .map(([iso, entry]) => (
                      <li key={iso} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-3">
                        <span className="flex shrink-0 items-baseline gap-2 sm:w-28">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {format(new Date(`${iso}T12:00:00`), 'EEE d')}
                          </span>
                          <span className="font-mono text-sm font-semibold tabular-nums">
                            {entry.percent}%
                          </span>
                        </span>
                        <NoteWithAppTags note={entry.note} apps={apps} />
                      </li>
                    ))}
                </ul>
              </div>
              )
            })}
          </div>
        )}
      </section>
  )
}

// ---------------------------------------------------------------------------
// Zone states
/**
 * A day's note, with the `[Project Name]` tags people write at the end lifted
 * out and rendered as links.
 *
 * The tags were showing as literal brackets mid-paragraph, which is both ugly
 * and a dead end — the project they name is one click away and the note could
 * not take you there. An unmatched tag still renders, just without a link: the
 * person wrote it, and a project renamed last month must not silently eat a
 * word out of their own account of their day.
 */
function NoteWithAppTags({ note, apps }: { note: string | null; apps: AppRef[] }) {
  const { text, tags } = splitNoteAppTags(note, apps)

  if (!text && tags.length === 0) {
    return <span className="min-w-0 flex-1 text-muted-foreground">No note</span>
  }

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      {text ? <span className={cn(bilingualText, 'min-w-0')}>{text}</span> : null}
      {tags.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {tags.map((tag, i) =>
            tag.slug ? (
              <Link
                key={`${tag.label}-${i}`}
                href={`/apps/${tag.slug}`}
                className="rounded border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-2xs text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tag.label}
              </Link>
            ) : (
              <span
                key={`${tag.label}-${i}`}
                className="rounded border border-border bg-muted/50 px-1.5 py-px font-mono text-2xs text-muted-foreground"
                title="No project answers to this name"
              >
                {tag.label}
              </span>
            ),
          )}
        </span>
      ) : null}
    </span>
  )
}

// ---------------------------------------------------------------------------

/**
 * One zone's failure, contained: an inline card with a retry, following the
 * admin/bugs pattern (role=alert, worded, no stack trace). A plain anchor
 * rather than a Link so retrying re-runs the server render even when the
 * router would have served the same URL from cache.
 */
function ZoneError({ title, retryHref }: { title: string; retryHref: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
        {title}
      </p>
      <p className="text-sm text-muted-foreground">
        Usually the database being briefly unreachable. The rest of the page still works.
      </p>
      <Button variant="outline" size="sm" render={<a href={retryHref} />}>
        Try again
      </Button>
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <span className="sr-only" role="status">
        Loading the month summary…
      </span>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[74px] rounded-lg" />
      ))}
    </div>
  )
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <span className="sr-only" role="status">
        Loading the calendar…
      </span>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="min-h-10 rounded-md sm:min-h-12" />
          ))}
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

function CatchUpSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
      <span className="sr-only" role="status">
        Loading the catch-up list…
      </span>
      <Skeleton className="h-4 w-52" />
      <Skeleton className="h-16 rounded-lg" />
    </div>
  )
}

function TeamSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <span className="sr-only" role="status">
        Loading the team view…
      </span>
      <Skeleton className="h-4 w-44" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  )
}
