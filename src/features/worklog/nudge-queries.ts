import { and, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import { dailyWorklogs, users, workSchedules } from '@/db/schema'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { isoDayAdd } from '@/features/people/iso-day'
import { absenceDays } from '@/features/worklog/absence-days'
import { exemptingAbsences } from '@/features/worklog/absence-kinds'
import { computeCoverage } from '@/features/worklog/coverage'
import { buildHolidayCalendar, closesTheStudio } from '@/features/worklog/holiday-listing'
import { listOrgHolidays } from '@/features/worklog/org-holiday-queries'
import { getTeamApprovedAbsences, getTeamRoster } from '@/features/worklog/queries'
import { patternForDay, type ScheduleRow } from '@/features/worklog/schedules'
import { resolveWorkDay } from '@/features/worklog/worklog-day'
import type { NudgeInput } from '@/features/worklog/nudge'

/**
 * Everybody's unlogged days, in a FIXED NUMBER OF QUERIES.
 *
 * The per-person reads on /worklog (`getMyWorkSchedule`, `getUserJoinDay`,
 * `getMyWorklogsInRange`) are right for a page rendering one person and wrong
 * for a nightly tick over the whole roster: twenty people would be a hundred
 * round trips inside a handler with a 60-second ceiling. Five reads here,
 * whatever the roster size, and the per-person maths is `computeCoverage` — the
 * same pure function the page uses, so the count in somebody's inbox and the
 * count on their screen cannot disagree.
 *
 * READ-ONLY. Nothing here writes, and the tick that calls it writes only
 * notifications.
 */

/**
 * How far back the tick looks.
 *
 * SHORTER THAN THE PAGE'S 120. The message can only ever name
 * MAX_BACKFILL_DAYS of backlog (see nudge.ts), and a wider window makes the
 * coverage walk longer for every person on the roster while changing nothing
 * anybody is told. Sixty days is well past anything the ledger will offer to
 * fill in.
 */
const NUDGE_WINDOW_DAYS = 60

export async function collectWorklogNudgeInputs(now: Date): Promise<NudgeInput[]> {
  const today = resolveWorkDay(now)
  const from = isoDayAdd(today, -NUDGE_WINDOW_DAYS)
  // Half-open, and `to` is tomorrow so today sits INSIDE the window and falls
  // out as `not-yet-due` — the same rule that drops a Sunday, rather than a
  // special case somebody has to remember. Nobody is nudged about a day still
  // in progress.
  const to = isoDayAdd(today, 1)

  const roster = await getTeamRoster()
  if (roster.length === 0) return []
  const userIds = roster.map((member) => member.userId)

  const [joinRows, logRows, absences, scheduleRows, orgRows] = await Promise.all([
    // The join day, in bulk. A day before somebody started is not theirs to log
    // and must never be counted against them — the same rule coverage applies
    // per person on the page.
    db
      .select({ id: users.id, createdAt: users.createdAt })
      .from(users)
      .where(inArray(users.id, userIds)),
    db
      .select({ userId: dailyWorklogs.userId, day: dailyWorklogs.day })
      .from(dailyWorklogs)
      .where(
        and(
          inArray(dailyWorklogs.userId, userIds),
          gte(dailyWorklogs.day, from),
          lte(dailyWorklogs.day, today),
        ),
      ),
    // APPROVED ONLY — a pending absence exempts nothing, so nobody escapes a
    // nudge by filing a request nobody has decided on yet.
    getTeamApprovedAbsences(from, today),
    db
      .select({
        userId: workSchedules.userId,
        pattern: workSchedules.pattern,
        effectiveFrom: workSchedules.effectiveFrom,
        effectiveTo: workSchedules.effectiveTo,
      })
      .from(workSchedules)
      .where(inArray(workSchedules.userId, userIds)),
    listOrgHolidays(),
  ])

  const joinedOn = new Map<string, string>()
  for (const row of joinRows) {
    joinedOn.set(row.id, toIsoDateInTimeZone(row.createdAt, LK_TIMEZONE))
  }

  // `closesTheStudio`, not every holiday row: a revoked company holiday must not
  // excuse a day the denominator still counts.
  const closed = new Set<string>()
  for (const row of buildHolidayCalendar(orgRows)) {
    if (row.day < from || row.day > today) continue
    if (closesTheStudio(row)) closed.add(row.day)
  }
  const isHoliday = (iso: string) => closed.has(iso)

  const logsByUser = new Map<string, Set<string>>()
  for (const row of logRows) {
    const set = logsByUser.get(row.userId) ?? new Set<string>()
    set.add(row.day)
    logsByUser.set(row.userId, set)
  }

  const absencesByUser = new Map<string, { startDate: string; endDate: string; kind: string }[]>()
  for (const row of absences) {
    const list = absencesByUser.get(row.userId) ?? []
    list.push({ startDate: row.startDate, endDate: row.endDate, kind: row.kind })
    absencesByUser.set(row.userId, list)
  }

  const schedulesByUser = new Map<string, ScheduleRow[]>()
  for (const row of scheduleRows) {
    const list = schedulesByUser.get(row.userId) ?? []
    // The columns are timestamps and `patternForDay` compares DAYS, so the
    // conversion happens here — exactly as getMyWorkSchedule does it for the
    // single-person read. Colombo, never UTC: at +05:30 a midnight timestamp
    // slices to the previous day and a schedule would start a day early.
    list.push({
      pattern: row.pattern,
      effectiveFrom: toIsoDateInTimeZone(row.effectiveFrom, LK_TIMEZONE),
      effectiveTo: row.effectiveTo ? toIsoDateInTimeZone(row.effectiveTo, LK_TIMEZONE) : null,
    })
    schedulesByUser.set(row.userId, list)
  }
  // Newest first, the order patternForDay expects — getMyWorkSchedule sorts
  // this way and the pure function relies on it to pick the schedule in force.
  for (const list of schedulesByUser.values()) {
    list.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))
  }

  const out: NudgeInput[] = []
  for (const member of roster) {
    const joined = joinedOn.get(member.userId)
    // No join day on record means no window to owe days in. Skipping is the
    // safe direction: the alternative is telling somebody they are behind on
    // days that predate their account.
    if (!joined) continue

    const schedule = schedulesByUser.get(member.userId) ?? []
    const coverage = computeCoverage({
      from,
      to,
      loggedDays: logsByUser.get(member.userId) ?? new Set<string>(),
      // Whole-day kinds only. A half day or a short leave leaves the day owed,
      // so somebody who filed one is still nudged about it — correctly: they
      // worked the rest of that day and it is still theirs to describe.
      exemptDays: absenceDays(exemptingAbsences(absencesByUser.get(member.userId) ?? []), from, to),
      isHoliday,
      patternFor: (iso) => patternForDay(schedule, iso),
      joinedOn: joined,
      today,
    })

    const owed = coverage.days.filter((day) => day.status === 'missing').map((day) => day.day)
    if (owed.length === 0) continue
    out.push({ userId: member.userId, name: member.name, owed })
  }

  return out
}
