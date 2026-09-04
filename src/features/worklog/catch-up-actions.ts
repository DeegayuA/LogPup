'use server'

import { format } from 'date-fns'
import { GeminiError, callGemini } from '@/features/gemini/client'
import { resolveChain } from '@/features/gemini/model-choice'
import { aiFeatureDisabledMessage, getAiPrefs } from '@/features/gemini/prefs'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { getSessionUser } from '@/lib/session'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { isoDayAdd } from '@/features/people/iso-day'
import { absenceDays } from '@/features/worklog/absence-days'
import { exemptingAbsences } from '@/features/worklog/absence-kinds'
import { computeCoverage } from '@/features/worklog/coverage'
import { buildHolidayCalendar, closesTheStudio } from '@/features/worklog/holiday-listing'
import { listOrgHolidays } from '@/features/worklog/org-holiday-queries'
import { patternForDay } from '@/features/worklog/schedules'
import { resolveWorkDay } from '@/features/worklog/worklog-day'
import { getMyEntryTotalsInRange } from '@/features/worklog/entry-queries'
import {
  getMyApprovedAbsences,
  getMyAssignedApps,
  getMyWorkSchedule,
  getMyWorklogsInRange,
  getUserJoinDay,
  listAllLiveAppsForPicker,
} from '@/features/worklog/queries'
import {
  MAX_PASTE_CHARS,
  buildCatchUpPrompt,
  readCatchUpReply,
  type CatchUpCandidateDay,
  type CatchUpReading,
} from '@/features/worklog/catch-up-parse'

/**
 * "Here is my week. Work out what I meant."
 *
 * READS AND PROPOSES. NOTHING ELSE. This action calls a model and hands back
 * suggestions; the person edits them and saves through the ordinary write paths
 * — `upsertDailyWorklog`, `createWorklogEntry`, `createAbsence` — each of which
 * still applies its own rules. There is deliberately no write here and no
 * `targetUserId`: a work log is a first-person statement, and a bulk importer
 * that filed a week on somebody's behalf would be a machine's account of their
 * week wearing their name.
 *
 * THE FENCES LIVE IN catch-up-parse.ts, not in this file and not in the prompt.
 * This one gathers what the model may see and what it may name; that one judges
 * the reply against the same lists, so a model that ignores its instructions
 * changes nothing that reaches a screen.
 */

/**
 * How far back a paste may reach.
 *
 * The catch-up ledger itself looks back 120 days, but every candidate day is a
 * LINE IN THE PROMPT, and somebody writing out their fortnight does not need
 * four months of dates offered to them. Sixty days covers a long absence and
 * the fortnight-of-good-intentions case alike; anything older is still logged
 * one day at a time from the calendar.
 */
const CANDIDATE_WINDOW_DAYS = 60

/** What the review panel needs to render a proposed day it did not already know about. */
export type CatchUpDayFacts = {
  day: string
  label: string
  fraction: number
  logged: boolean
  closedFor: string | null
  /** Minutes already on the day — see CatchUpCandidateDay.loggedMinutes. */
  loggedMinutes: number
}

export type CatchUpResult = CatchUpReading & {
  /** One entry per day the reading names, so the UI never renders a bare ISO string. */
  facts: CatchUpDayFacts[]
  /** How many days were offered, so "nothing came back" can be honest about why. */
  candidateCount: number
}

/**
 * The actor, if they may write their own worklog at all.
 *
 * The same two lines `writer()` in entry-actions.ts uses, and deliberately the
 * same capability: this proposes rows only that person's own hands can save, so
 * a seat that cannot write a worklog (stakeholder, auditor) has no business
 * generating one either. Restated rather than imported because entry-actions.ts
 * is a `'use server'` module and may only export async actions.
 */
async function writer() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'worklog.write.own', { ownerId: actor.id })) return null
  const user = await getSessionUser()
  return { id: actor.id, name: user?.name?.trim() || null }
}

export async function readCatchUpText(text: string): Promise<ActionResult<CatchUpResult>> {
  const actor = await writer()
  if (!actor) return err('Not allowed')

  const disabled = await aiFeatureDisabledMessage(actor.id, 'worklog-catch-up')
  if (disabled) return err(disabled)

  const paste = typeof text === 'string' ? text.trim() : ''
  if (!paste) return err('Write your days out first, then LogPup will read them')
  if (paste.length > MAX_PASTE_CHARS) {
    return err(
      `That is longer than ${MAX_PASTE_CHARS} characters — send it in two halves and both will be read`,
    )
  }

  const today = resolveWorkDay(new Date())
  const windowStart = isoDayAdd(today, -CANDIDATE_WINDOW_DAYS)
  // Half-open on the right for coverage, which walks [from, to).
  const toExclusive = isoDayAdd(today, 1)

  const [joinedOn, rows, approved, schedule, hourTotals, orgRows, assignedApps, allApps] =
    await Promise.all([
    getUserJoinDay(actor.id),
    getMyWorklogsInRange(actor.id, windowStart, today),
    getMyApprovedAbsences(actor.id, windowStart, today),
    getMyWorkSchedule(actor.id),
    getMyEntryTotalsInRange(actor.id, windowStart, today),
    listOrgHolidays(),
    getMyAssignedApps(actor.id),
    // Every live project, not just this person's: helping out on somebody
    // else's app for an afternoon is exactly the kind of day that goes
    // unlogged, and the reader must be able to hear its name.
    listAllLiveAppsForPicker(),
  ])

  // A day before somebody joined is not theirs to log, so the window starts at
  // the later of the two. With no join day on record the window stands as is.
  const from = joinedOn && joinedOn > windowStart ? joinedOn : windowStart
  if (from > today) return err('There are no days to log yet')

  const closed = new Map<string, string>()
  for (const row of buildHolidayCalendar(orgRows)) {
    if (row.day < from || row.day > today) continue
    // `closesTheStudio`, not every holiday row: a revoked company holiday must
    // not be described to the model as a day the studio was shut.
    if (!closesTheStudio(row)) continue
    if (!closed.has(row.day)) closed.set(row.day, row.name)
  }

  const loggedDays = new Set(rows.map((row) => row.day))
  const coverage = computeCoverage({
    from,
    to: toExclusive,
    loggedDays,
    // APPROVED AND WHOLE-DAY ONLY. A pending absence exempts nothing, and a
    // half day exempts nothing either — see absence-kinds.ts.
    exemptDays: absenceDays(exemptingAbsences(approved), from, toExclusive),
    isHoliday: (iso) => closed.has(iso),
    patternFor: (iso) => patternForDay(schedule, iso),
    joinedOn: joinedOn ?? from,
    today,
  })

  const candidateDays: CatchUpCandidateDay[] = coverage.days.map((day) => ({
    day: day.day,
    label: format(new Date(`${day.day}T12:00:00`), 'EEE d MMM'),
    fraction: day.fraction,
    // Hours without a score is NOT logged, for the same reason it is not
    // anywhere else on this page: the score is the day record.
    logged: loggedDays.has(day.day),
    closedFor: closed.get(day.day) ?? null,
    loggedMinutes: hourTotals.get(day.day)?.minutes ?? 0,
  }))

  // Assigned first, then the rest of the studio. The reader sees every project
  // either way — the order only decides which one wins a genuinely ambiguous
  // nickname, and somebody's own assignments are the better bet.
  // `aliases` travels with each one: it is what turns "ML model for SGX" into a
  // real project id, and a list without it is the list that lost the
  // attribution in the first place.
  const apps = [
    ...assignedApps.map((app) => ({ id: app.id, name: app.name, aliases: app.aliases })),
    ...allApps
      .filter((app) => !assignedApps.some((mine) => mine.id === app.id))
      .map((app) => ({ id: app.id, name: app.name, aliases: app.aliases })),
  ]

  const prompt = buildCatchUpPrompt({
    name: actor.name ?? 'This engineer',
    today,
    candidateDays,
    apps,
    text: paste,
  })

  try {
    const prefs = await getAiPrefs(actor.id)
    const { text: replyText } = await callGemini(actor.id, [{ text: prompt }], {
      models: resolveChain('worklog-catch-up', prefs['worklog-catch-up'].model),
      responseJson: true,
      feature: 'worklog.catch-up',
    })

    const reading = readCatchUpReply(replyText, {
      allowedDays: new Set(candidateDays.map((day) => day.day)),
      allowedAppIds: new Set(apps.map((app) => app.id)),
    })

    // Only the days the reading actually named, so the client is not handed
    // sixty rows to find four in.
    const named = new Set(reading.days.map((day) => day.day))
    const facts: CatchUpDayFacts[] = candidateDays
      .filter((day) => named.has(day.day))
      .map((day) => ({
        day: day.day,
        label: day.label,
        fraction: day.fraction,
        logged: day.logged,
        closedFor: day.closedFor ?? null,
        loggedMinutes: day.loggedMinutes,
      }))

    return ok({ ...reading, facts, candidateCount: candidateDays.length })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message, error.code)
    return err('Could not read that right now — fill the days in yourself or try again')
  }
}
