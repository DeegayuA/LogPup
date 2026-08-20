import { totalMinutes, type EntryCategory } from '@/features/worklog/entries'

/**
 * The worklog cross-check: what the app noticed about a day, compared with
 * the evidence it already holds.
 *
 * PURE. NO DATABASE, NO MODEL, NO CLOCK. This is the whole point of the file.
 *
 * THE PURE-FUNCTION COMMITMENT. The AI is asked ONLY to phrase what this
 * function found — never to decide what is wrong. An AI that invents a
 * discrepancy about how somebody spent their working day is worse than no
 * check at all, and this function is the structural guarantee that it cannot:
 * if `findDiscrepancies` returns nothing, there is nothing for the model to
 * say, and every observation it does phrase is one of the six kinds below
 * with facts computed here. Every kind is unit-tested with no model in the
 * loop.
 *
 * TONE LIVES IN THE DATA, not in a prompt. Observations are OBSERVATIONAL.
 * "3 hours have no matching activity" is a fact; "you did not work" is an
 * accusation, and the difference is not the model's to get right. The person
 * was there and the app was not, so every message here describes what the app
 * can see and stops.
 *
 * THE PERSON SEES IT FIRST. These observations are shown to the author of the
 * entries and are not surfaced in any admin rollup. Worklog writes are
 * self-only by deliberate design because the record is a first-person
 * statement; an AI-flagged "your hours do not match your activity" that a
 * manager reads before the author does converts that statement into an
 * accusation they never had a chance to answer.
 */

export type ObservationKind =
  /** The day's total is far ABOVE what was scheduled. */
  | 'over-scheduled'
  /** The day's total is far BELOW what was scheduled. */
  | 'under-scheduled'
  /** Meetings were attended that the entries do not account for. */
  | 'meeting-unaccounted'
  /** Time logged against a task that shows no activity that day. */
  | 'task-without-activity'
  /** Hours logged on a day with no recorded activity or meetings at all. */
  | 'unaccounted-gap'
  /** The same task appears on more than one entry. */
  | 'duplicate-task'

/**
 * How loudly the UI should render an observation.
 *
 * 'note' — a quiet fact, rendered small and without emphasis. Everything in
 *   this bucket is a "you might not have logged enough" shape, and those are
 *   exactly the ones that read as an accusation when rendered loudly. Being
 *   heads-down for three hours is normal work, not a finding.
 * 'question' — worth a look, because the most likely explanation is a
 *   correctable mistake in the entry (a mistyped duration, one entry saved
 *   twice, a meeting nobody logged) rather than anything about the person.
 *
 * NOTE THAT NEITHER IS 'error' OR 'warning'. Saving always succeeds; nothing
 * here blocks, and a severity that implied otherwise would invite a UI that
 * does.
 */
export type ObservationSeverity = 'note' | 'question'

export type Observation = {
  kind: ObservationKind
  severity: ObservationSeverity
  /**
   * The observation as a plain sentence — already safe to show verbatim if
   * no model is available, which is also the fallback when the AI call fails.
   */
  message: string
  /**
   * The numbers behind the sentence, so the UI and the phrasing model both
   * work from what was computed rather than re-deriving it from the prose.
   */
  facts: Record<string, number | string | readonly string[]>
}

export type AttendedMeeting = {
  /** Real recorded start/end — the strongest signal here, because it was
   *  recorded rather than remembered. */
  startedAt: Date
  endedAt: Date
  title: string
}

export type DayEvidence = {
  meetingsAttended: readonly AttendedMeeting[]
  /** Activity-log rows for this person that day: tasks moved, comments, check-ins. */
  activityCount: number
  /**
   * The day's scheduled length in minutes, or NULL when it is not known.
   *
   * NULL IS A REAL AND EXPECTED VALUE, not a caller bug. There is no
   * minutes-per-full-day constant in this repo — `patternForDay` returns a
   * FRACTION per weekday and nothing states what a fraction of 1 is worth in
   * minutes. That is a pending product decision (see accountedFraction in
   * entries.ts), so until it lands most callers genuinely cannot say.
   *
   * When it is null the two schedule-comparing observations are SKIPPED
   * entirely. They are never computed against an assumed day: an invented
   * denominator here would produce "you are three hours short" from a number
   * nobody chose, which is the single worst thing this feature could say.
   */
  scheduledMinutes: number | null
  /** Task ids this person demonstrably touched that day, from the activity log. */
  tasksTouched: readonly string[]
}

export type CheckEntry = {
  minutes: number
  category: EntryCategory | (string & {})
  taskId?: string | null
  /** For naming the task in a message when the caller has a title to hand. */
  taskTitle?: string | null
}

/**
 * Thresholds, named and exported so the tests, the UI and any future tuning
 * argue with one set of numbers instead of three.
 *
 * These are deliberately SLACK, not precision. Recall at the end of a day is
 * approximate by nature, and a check that fires on a twenty-minute
 * discrepancy trains people to dismiss it — at which point it catches the
 * real ones too. Silence is the common case and must stay the common case.
 */
export const CHECK_THRESHOLDS = {
  /** Above this multiple of the scheduled day, say something. 1.25 of an 8h day is 10h. */
  overScheduledRatio: 1.25,
  /** Below this multiple, say something. 0.6 of an 8h day is under 5h. */
  underScheduledRatio: 0.6,
  /** Ignore a total/schedule difference smaller than this either way. */
  scheduleSlackMinutes: 60,
  /** Meeting time attended but unaccounted for, before it is worth mentioning. */
  meetingSlackMinutes: 30,
  /** Hours logged on a day with no evidence at all, before it is worth mentioning. */
  gapMinutes: 180,
} as const

/** Whole hours where they are whole, one decimal otherwise — "6.5", "8". */
const hrs = (minutes: number) => String(Math.round((minutes / 60) * 10) / 10)

/**
 * "1 hour" / "2.5 hours", so no message has to say "1 hours".
 *
 * Every message below is built to stay grammatical at EVERY value, which
 * rules out an article or a verb that has to agree with the number: "a 8
 * hours day" and "1 hour are logged" are both reachable from innocent-looking
 * templates. These strings are the fallback rendered verbatim when the
 * phrasing model is unavailable or fails, so they are real product copy
 * rather than prompt input, and a threshold change must not be able to turn
 * one of them ungrammatical.
 */
const hoursPhrase = (minutes: number) => {
  const value = hrs(minutes)
  return `${value} ${value === '1' ? 'hour' : 'hours'}`
}

/**
 * Attended meeting minutes, with OVERLAPS MERGED.
 *
 * Summing durations double-counts a double-booking, and somebody invited to
 * two meetings in the same hour did not spend two hours in them. An inflated
 * attended total would then manufacture a "meeting time unaccounted for"
 * observation out of nothing — a discrepancy the app invented, which is the
 * exact failure this module exists to make impossible.
 */
function mergedMeetingMinutes(meetings: readonly AttendedMeeting[]): number {
  const spans = meetings
    .map((m) => ({ start: m.startedAt.getTime(), end: m.endedAt.getTime() }))
    // A zero or negative span is bad data, not a meeting; drop it rather than
    // subtracting time from the day.
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start)

  let total = 0
  let cursor = -Infinity
  for (const span of spans) {
    const from = Math.max(span.start, cursor)
    if (span.end > from) total += span.end - from
    cursor = Math.max(cursor, span.end)
  }
  return Math.round(total / 60_000)
}

/**
 * Everything the app noticed about this day, in a stable order.
 *
 * Entries must be LIVE ones (soft-deleted rows filtered at the query layer
 * through `liveWorklogEntries`) — a deleted entry counted into somebody's
 * total would be the app contradicting them about their own hours.
 *
 * An empty array means SILENCE, and silence is the common case: when nothing
 * is returned the UI renders nothing at all, so a quiet check reads as
 * success rather than as a check that failed to run.
 */
export function findDiscrepancies(
  entries: readonly CheckEntry[],
  evidence: DayEvidence,
): Observation[] {
  const out: Observation[] = []

  // Nothing logged at all is not a discrepancy — it is an empty day, which
  // the calendar's own 'Missing' state already says plainly. Repeating it
  // here would make every unopened day generate observations.
  if (entries.length === 0) return out

  const logged = totalMinutes(entries)
  const { scheduledMinutes } = evidence

  // --- 1 & 2. The day against its schedule -------------------------------
  //
  // Skipped entirely when the schedule is unknown. See DayEvidence.
  if (scheduledMinutes !== null && scheduledMinutes > 0) {
    const difference = Math.abs(logged - scheduledMinutes)
    if (difference >= CHECK_THRESHOLDS.scheduleSlackMinutes) {
      if (logged > scheduledMinutes * CHECK_THRESHOLDS.overScheduledRatio) {
        out.push({
          kind: 'over-scheduled',
          severity: 'question',
          message:
            `That day adds up to ${hoursPhrase(logged)}, against ${hoursPhrase(scheduledMinutes)} `
            + 'scheduled.',
          facts: { loggedMinutes: logged, scheduledMinutes, differenceMinutes: difference },
        })
      } else if (logged < scheduledMinutes * CHECK_THRESHOLDS.underScheduledRatio) {
        out.push({
          kind: 'under-scheduled',
          severity: 'note',
          message:
            `That day accounts for ${hoursPhrase(logged)}, against `
            + `${hoursPhrase(scheduledMinutes)} scheduled.`,
          facts: { loggedMinutes: logged, scheduledMinutes, differenceMinutes: difference },
        })
      }
    }
  }

  // --- 3. Meetings attended but not accounted for -------------------------
  const attendedMinutes = mergedMeetingMinutes(evidence.meetingsAttended)
  if (attendedMinutes > 0) {
    const meetingMinutes = totalMinutes(entries.filter((e) => e.category === 'meeting'))
    const shortfall = attendedMinutes - meetingMinutes
    if (shortfall >= CHECK_THRESHOLDS.meetingSlackMinutes) {
      const titles = evidence.meetingsAttended.map((m) => m.title)
      out.push({
        kind: 'meeting-unaccounted',
        severity: 'question',
        message:
          meetingMinutes === 0
            ? `That day has ${hoursPhrase(attendedMinutes)} of recorded meetings, with no meeting `
              + 'time logged.'
            : `That day has ${hoursPhrase(attendedMinutes)} of recorded meetings, and `
              + `${hoursPhrase(meetingMinutes)} logged.`,
        facts: {
          attendedMinutes,
          loggedMeetingMinutes: meetingMinutes,
          shortfallMinutes: shortfall,
          meetings: titles,
        },
      })
    }
  }

  // --- 4. Hours against a task with no activity that day ------------------
  //
  // PER TASK, and phrased with its own reassurance: heads-down work leaves no
  // trace in an activity log, and that is normal rather than suspicious. The
  // observation exists because the OTHER explanation — time logged to the
  // wrong task — is worth catching, not because silence implies idleness.
  const touched = new Set(evidence.tasksTouched)
  const byTask = new Map<string, { minutes: number; title: string | null }>()
  for (const entry of entries) {
    if (entry.taskId == null || entry.taskId === '') continue
    const seen = byTask.get(entry.taskId)
    byTask.set(entry.taskId, {
      minutes: (seen?.minutes ?? 0) + entry.minutes,
      title: seen?.title ?? entry.taskTitle ?? null,
    })
  }

  for (const [taskId, { minutes, title }] of byTask) {
    if (touched.has(taskId)) continue
    const name = title ?? 'that task'
    out.push({
      kind: 'task-without-activity',
      severity: 'note',
      message:
        `${hoursPhrase(minutes)} went to ${name}, which shows no activity that day — normal for `
        + 'heads-down work.',
      facts: { taskId, minutes, taskTitle: title ?? '' },
    })
  }

  // --- 5. A multi-hour stretch with no evidence behind it -----------------
  //
  // DISTINCT from under-scheduled, which compares the day to its schedule.
  // This one compares the day to the EVIDENCE: hours are logged, and the app
  // recorded nothing at all that day — no meetings, no activity rows. Also
  // distinct from task-without-activity, which is per task; this is the whole
  // day, and it covers the non-task categories that have no task to check.
  if (
    evidence.activityCount === 0
    && evidence.meetingsAttended.length === 0
    && logged >= CHECK_THRESHOLDS.gapMinutes
  ) {
    out.push({
      kind: 'unaccounted-gap',
      severity: 'note',
      message:
        `That day has ${hoursPhrase(logged)} logged with no recorded activity or meetings, which `
        + 'is normal for heads-down work.',
      facts: { loggedMinutes: logged, activityCount: 0 },
    })
  }

  // --- 6. The same task logged twice --------------------------------------
  //
  // A 'question' rather than a 'note' because both explanations are things
  // the person may want to act on, and the message names both: two genuine
  // sessions on one task is perfectly normal, and one entry saved twice is a
  // mistake worth catching before it doubles a task's hours.
  const taskCounts = new Map<string, number>()
  for (const entry of entries) {
    if (entry.taskId == null || entry.taskId === '') continue
    taskCounts.set(entry.taskId, (taskCounts.get(entry.taskId) ?? 0) + 1)
  }
  for (const [taskId, count] of taskCounts) {
    if (count < 2) continue
    const info = byTask.get(taskId)
    const name = info?.title ?? 'One task'
    out.push({
      kind: 'duplicate-task',
      severity: 'question',
      message:
        `${name} appears on ${count} entries totalling ${hoursPhrase(info?.minutes ?? 0)} — two `
        + 'sessions, or one entry saved twice?',
      facts: { taskId, entryCount: count, minutes: info?.minutes ?? 0 },
    })
  }

  return out
}
