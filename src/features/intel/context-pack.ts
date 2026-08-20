import type { Session } from 'next-auth'
import { and, asc, eq, gte, isNull, lt } from 'drizzle-orm'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { meetingAiNotes, meetingAttendees } from '@/db/schema'
import { loadActor } from '@/features/auth/actor'
import { UNWRITTEN_MEETING_LIMIT } from '@/features/intel/signals'
import { absenceDays } from '@/features/worklog/absence-days'
import { getMyPendingAbsences } from '@/features/worklog/queries'
import { listApps } from '@/features/apps/queries'
import { sortCapacities } from '@/features/dashboard/sort-capacities'
import { isoDayAdd, isoDayDiff, isoDayOf } from '@/features/people/iso-day'
import { getPersonFollowups, getPersonWorkload, getUserCapacities } from '@/features/people/queries'
import { DUE_STATE_LABEL, bucketOpenTasks, dueState } from '@/features/people/task-workload'
import { getActiveSprints } from '@/features/sprints/queries'
import { getCoverage } from '@/features/worklog/coverage-queries'
import type { SignalInput } from '@/features/intel/signals'

/**
 * The one read the /intel surface makes: everything the signal rules and the
 * two AI prompts are allowed to know, in a single batched pass.
 *
 * PERMISSIONS ARE INHERITED, NEVER WIDENED. Every read below is one this
 * person already gets somewhere else, through the same query and the same
 * gate:
 *
 *   - tasks, follow-ups, unwritten meetings  -> keyed to session.user.id, so
 *     they are the caller's OWN rows (the dashboard's MyDayZone reads exactly
 *     these three for exactly this person).
 *   - capacities, sprints, apps              -> ungated in this repo today
 *     (TeamZone and /people render them to every signed-in active user;
 *     people/cohorts.ts carries the standing ruling that no fourth opinion on
 *     visibility gets invented at a new call site).
 *   - worklog coverage                       -> the ONE gated read here, and
 *     the gate is getCoverage's own: it refuses with null rather than
 *     throwing, and this asks only about the caller themself.
 *
 * A prompt is not a reason to read more than the page would show. If a future
 * signal needs a wider read, it needs the capability check first.
 */

/** Every list is capped so no prompt can grow with the workspace. */
const CAPACITY_LIMIT = 12
const SPRINT_LIMIT = 8
const QUIET_APP_LIMIT = 8
const TASK_LINE_LIMIT = 12
/** Follow-ups are bounded by status='open', never by a LIMIT — so the pack caps them. */
const FOLLOWUP_LINE_LIMIT = 10

/** How far back the worklog gap question looks — MAX_BACKFILL_DAYS' fortnight. */
const WORKLOG_WINDOW_DAYS = 14

/**
 * How far back a meeting can have ended and still count as "nobody wrote this
 * up". Older than this it is history, not a nudge, and it would only ever push
 * a fresher meeting off the capped list.
 */
const UNWRITTEN_MEETING_WINDOW_DAYS = 30

/**
 * The hard ceiling on the grounding text. Two AI features share it, and the
 * registry prices both at ~8k input tokens — a pack that outgrows this quietly
 * makes both estimates lies and pushes a free key toward its per-request limit.
 */
const GROUNDING_MAX_CHARS = 8_000

/**
 * One row the grounding pack actually carried, with the route it points at.
 *
 * Exposed separately from the prose because an answer that could NOT be
 * grounded still owes the reader the rows it looked at — see `grounded` on
 * AskAnswer. Read off the FINAL text rather than the pre-truncation entries on
 * purpose: `fit` drops rows to meet the character ceiling, and offering a
 * citation to a row the model never saw would be the same lie in the other
 * direction.
 */
export type GroundingSource = { label: string; href: string }

export type WorkspaceSnapshot = {
  signalInput: SignalInput
  grounding: string
  sources: GroundingSource[]
}

export async function loadWorkspaceSnapshot(
  user: Session['user'],
  now: Date,
): Promise<WorkspaceSnapshot> {
  const todayIso = isoDayOf(now)
  const name = user.name?.trim() || user.email
  // Half-open [from, today): getCoverage excludes `to`, and today is still in
  // progress — counting it missing accuses the person every morning.
  const gapFrom = isoDayAdd(todayIso, -WORKLOG_WINDOW_DAYS)
  const unwrittenSince = new Date(now.getTime() - UNWRITTEN_MEETING_WINDOW_DAYS * 86_400_000)

  // ONE Promise.all. On the Neon HTTP driver each await is a full round trip,
  // and a person is watching this one resolve — eight serialized reads here is
  // eight times the latency of eight parallel ones.
  const [
    workload,
    followups,
    capacities,
    sprints,
    apps,
    unwritten,
    coverage,
    pendingAbsences,
  ] = await Promise.all([
    getPersonWorkload(user.id),
    getPersonFollowups(user.id),
    getUserCapacities(),
    getActiveSprints(),
    listApps(),
    // Meetings this person ATTENDED that finished without a write-up. No such
    // query existed, so it is written here rather than added to the meetings
    // feature: it is the only caller.
    //
    // meetingAttendees and meetingAiNotes carry no deletedAt of their own
    // (MEETING_CHILD_TABLES in src/db/live.ts) — the innerJoin against
    // liveMeetings is what stops a trashed meeting's rows reading.
    //
    // isNull(summary) over a LEFT join answers both halves of "unwritten" in
    // one predicate: no meeting_ai_notes row at all leaves every joined column
    // NULL, and an analysis that produced no summary stores NULL too.
    db
      .select({
        id: liveMeetings.id,
        title: liveMeetings.title,
        endsAt: liveMeetings.endsAt,
      })
      .from(meetingAttendees)
      .innerJoin(liveMeetings, eq(meetingAttendees.meetingId, liveMeetings.id))
      .leftJoin(meetingAiNotes, eq(meetingAiNotes.meetingId, liveMeetings.id))
      .where(
        and(
          eq(meetingAttendees.userId, user.id),
          lt(liveMeetings.endsAt, now),
          gte(liveMeetings.endsAt, unwrittenSince),
          isNull(meetingAiNotes.summary),
        ),
      )
      // ASCENDING: the oldest unwritten meetings, not the newest. The signal
      // names "the oldest" one and counts the rest, so a descending slice made
      // both claims about the ten most RECENT — the oldest of a recent slice is
      // not the oldest, and a stale meeting from three weeks back never
      // appeared at all.
      .orderBy(asc(liveMeetings.endsAt))
      .limit(UNWRITTEN_MEETING_LIMIT),
    // Coverage genuinely depends on the actor, so it is one chained pair
    // INSIDE the batch rather than an await in front of it — the two hops run
    // alongside the other five reads instead of ahead of them. loadActor is
    // React.cache'd, so a page that already asked a capability question pays
    // nothing here. A deactivated account (null actor) and a refused read both
    // mean "no gap list", never a crash.
    loadActor().then((actor) =>
      actor ? getCoverage(actor, user.id, gapFrom, todayIso, todayIso) : null,
    ),
    // Inside the batch, not after it: this is an independent read and every
    // await in front of the others is another Neon round trip on a path
    // somebody is waiting on.
    getMyPendingAbsences(user.id),
  ])

  const rankedCapacities = sortCapacities(capacities).slice(0, CAPACITY_LIMIT)
  // Soonest deadline first: a sprint ending Friday is the one worth a line,
  // and sprintId breaks ties so two sprints ending the same day never swap
  // places between two renders of the same data.
  const rankedSprints = [...sprints]
    .sort((a, b) => (a.endDate === b.endDate ? a.sprintId.localeCompare(b.sprintId) : a.endDate < b.endDate ? -1 : 1))
    .slice(0, SPRINT_LIMIT)
  // Quietest first, and "never touched" is quieter than any date. Archived
  // apps are excluded outright: they are deliberately silent, so reporting one
  // as quiet is a false alarm the reader has to dismiss every single day.
  const rankedApps = apps
    .filter((app) => app.status !== 'archived')
    .sort((a, b) => {
      const left = a.stats.lastActivityAt?.getTime() ?? -1
      const right = b.stats.lastActivityAt?.getTime() ?? -1
      return left === right ? a.slug.localeCompare(b.slug) : left - right
    })
    .slice(0, QUIET_APP_LIMIT)
  // A day already covered by a PENDING absence leaves the gap list, because
  // /worklog's catch-up queue drops it too — getCoverage only exempts APPROVED
  // absences, so without this /intel raises a worklog.gap alert (severity
  // `alert` from three days) for days the other page is simultaneously
  // treating as dealt with. Two surfaces disagreeing about the same days is
  // worse than either answer alone: the reader cannot tell which is lying, and
  // the alert is one they have no action left to clear.
  //
  // Same helper and same query /worklog uses, deliberately. A private copy of
  // either is how the two answers drifted apart in the first place.
  //
  // THE SET PASSED HERE IS THE WHOLE RULING, AND NOTHING TESTS IT. absenceDays
  // is pure and carries its own tests, but it clips whatever ranges it is
  // handed — it cannot know which ones were meant, so handing it the wrong set
  // yields correct days for the wrong question and nothing anywhere goes red.
  // This line is the assumption a test would otherwise have pinned, so it is
  // written down instead:
  //
  //   PENDING only. Approved days are already gone — getCoverage never reports
  //   them missing, so including them here would be a no-op that reads like a
  //   safeguard. Rejected days must stay IN the gap list: a refused request is
  //   precisely the case where the day still has to be logged, and dropping it
  //   would hide the one absence outcome that leaves work owed.
  //
  // AND THE ASYMMETRY THAT LOOKS LIKE A BUG: a pending day leaves this GAP LIST
  // but stays in coverage's DENOMINATOR, because the two answer different
  // questions — "what should I do now" versus "what did this month actually
  // look like". /worklog holds the same split from the other end (its
  // exemptDays is approved-only, so nobody lowers their own denominator by
  // typing a request). Anyone who later surfaces a coverage FIGURE on /intel
  // inherits that: the percentage will count days this list deliberately does
  // not, and reconciling the two by filtering the denominator here would let a
  // person improve their own month by filing a request nobody has approved.
  const filedDays = absenceDays(pendingAbsences, gapFrom, todayIso)
  const gapDays = (coverage?.days ?? [])
    .filter((day) => day.status === 'missing' && !filedDays.has(day.day))
    .map((day) => day.day)

  const signalInput: SignalInput = {
    todayIso,
    me: { id: user.id, name },
    tasks: {
      overdue: workload.load.overdue,
      oldestOverdueDays: workload.load.oldestOverdueDays,
      dueSoon: workload.load.dueSoon,
    },
    followupsOwed: followups.owed.length,
    oldestOwedDays: followups.oldestOwedDays,
    capacities: rankedCapacities.map((row) => ({
      userId: row.user.id,
      name: row.user.name,
      pct: row.totalPct,
    })),
    sprints: rankedSprints.map((sprint) => ({
      id: sprint.sprintId,
      appSlug: sprint.appSlug,
      name: sprint.sprintName,
      endsOn: sprint.endDate,
      // There is no `open` column — todo + in_progress IS open (see
      // active-sprints.tsx, which derives the total the same way).
      openTasks: sprint.counts.todo + sprint.counts.in_progress,
      totalTasks: sprint.counts.todo + sprint.counts.in_progress + sprint.counts.done,
    })),
    worklogGapDays: gapDays,
    unwrittenMeetings: unwritten.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      endedIso: isoDayOf(meeting.endsAt),
    })),
    quietApps: rankedApps.map((app) => ({
      slug: app.slug,
      name: app.name,
      lastActivityIso: app.stats.lastActivityAt ? isoDayOf(app.stats.lastActivityAt) : null,
    })),
  }

  const orderedTasks = bucketOpenTasks(workload.openTasks, todayIso).flatMap((bucket) => bucket.tasks)

  const grounding = buildGrounding({
    name,
    todayIso,
    taskSummary:
      `${workload.load.open} open, ${workload.load.overdue} overdue`
      + `${workload.load.oldestOverdueDays !== null ? ` (oldest ${workload.load.oldestOverdueDays} days late)` : ''}`
      + `, ${workload.load.dueSoon} due within a week, across ${workload.load.apps} apps`,
    tasks: orderedTasks.slice(0, TASK_LINE_LIMIT).map((task) => ({
      line:
        `${task.title} — ${DUE_STATE_LABEL[dueState(task.dueDate, todayIso)]}`
        + `${task.dueDate ? ` ${task.dueDate}` : ''} — ${task.appName}`
        + `${task.sprintName ? ` / ${task.sprintName}` : ''}`,
      href: `/apps/${task.appSlug}`,
    })),
    tasksOmitted: Math.max(0, orderedTasks.length - TASK_LINE_LIMIT),
    followups: followups.owed.slice(0, FOLLOWUP_LINE_LIMIT).map((item) => ({
      line: `${item.text} — open ${item.ageDays} days, from "${item.meetingTitle}"`,
      href: `/meetings?open=${item.meetingId}`,
    })),
    followupsOmitted: Math.max(0, followups.owed.length - FOLLOWUP_LINE_LIMIT),
    gapDays,
    signalInput,
    coverageRefused: coverage === null,
  })

  // Read off the rendered pack, not the inputs above: `fit` drops rows to meet
  // the character ceiling, and a source the model never saw is as wrong as a
  // missing one.
  return { signalInput, grounding, sources: sourcesFromGrounding(grounding) }
}

// ---------------------------------------------------------------------------
// Grounding text
//
// Labelled plain text, not JSON and not a markdown table. JSON spends a third
// of the budget on punctuation the model does not need, and a table wraps into
// nonsense the moment one project name is long. Every entity line ends in the
// route that entity lives at, in square brackets, because the answer has to be
// able to cite somewhere a person can actually click.
// ---------------------------------------------------------------------------

type GroundingEntry = { line: string; href: string }

type GroundingSection = {
  heading: string
  lines: string[]
  /** Entries dropped by a cap — reported, never silently cut. */
  omitted: number
}

function entryLines(entries: GroundingEntry[]): string[] {
  return entries.map((entry) => `  - ${entry.line} [${entry.href}]`)
}

function renderSection(section: GroundingSection): string {
  const body =
    section.lines.length > 0
      ? section.lines
      : section.omitted > 0
        ? []
        : ['  nothing']
  const tail = section.omitted > 0 ? [`  (${section.omitted} more not shown)`] : []
  return [section.heading, ...body, ...tail].join('\n')
}

function render(header: string, sections: GroundingSection[]): string {
  return [header, ...sections.map(renderSection)].join('\n\n')
}

/**
 * Bring the pack under the ceiling by dropping whole entity lines from the
 * LAST section backwards, converting each drop into the section's "(N more not
 * shown)" count.
 *
 * Deterministic on purpose — the same workspace must produce the same pack
 * twice, or two identical questions get two different answers and nobody can
 * tell which one was truncated. Sections are ordered most- to least-personal
 * above, so the first thing to go is the team-wide colour, never the reader's
 * own overdue work.
 */
/** How many pack rows an ungrounded answer offers back. Same ceiling as
 *  MAX_CITATIONS in actions.ts: past six, a list of sources stops being a
 *  pointer and becomes the pack again. */
const MAX_SOURCES = 6

/**
 * Is this string a route that stays inside LogPup?
 *
 * ALLOWLIST, not a leading-character test, and shared with splitAnswer in
 * actions.ts so the two can never disagree. A leading '/' is not enough:
 * '/\evil.com' starts with a slash, but WHATWG URL parsing folds a backslash
 * into a slash, so the browser resolves it to https://evil.com/ and the
 * "citation" chip walks the reader off the product. That text is written by
 * the model, which reads task titles, meeting titles and follow-up text out
 * of the grounding pack — so a planted title is enough to steer it.
 */
export function isInAppRoute(href: string): boolean {
  // '//host' is a protocol-relative URL, not a route, and it clears the
  // character allowlist on its own.
  return /^\/[A-Za-z0-9/_\-?=&.#%]*$/.test(href) && !href.startsWith('//')
}

/**
 * The rows of a rendered pack, as clickable sources.
 *
 * Parses the one shape entryLines writes — "  - <text> [<route>]" — and
 * ignores everything else, so headings, the "nothing" placeholder and the
 * "(N more not shown)" tail can never become a citation.
 */
export function sourcesFromGrounding(text: string): GroundingSource[] {
  const sources: GroundingSource[] = []
  const seen = new Set<string>()
  for (const line of text.split('\n')) {
    const match = /^\s*-\s*(.+?)\s*\[(\/[^\]]*)\]\s*$/.exec(line)
    if (!match) continue
    const [, label, href] = match
    if (!isInAppRoute(href) || seen.has(href)) continue
    seen.add(href)
    sources.push({ label: label.length > 80 ? `${label.slice(0, 79)}\u2026` : label, href })
    if (sources.length >= MAX_SOURCES) break
  }
  return sources
}

function fit(header: string, sections: GroundingSection[]): string {
  const working = sections.map((section) => ({ ...section, lines: [...section.lines] }))
  for (let index = working.length - 1; index >= 0; index -= 1) {
    while (
      render(header, working).length > GROUNDING_MAX_CHARS
      && working[index].lines.length > 0
    ) {
      working[index].lines.pop()
      working[index].omitted += 1
    }
    if (render(header, working).length <= GROUNDING_MAX_CHARS) break
  }
  return render(header, working)
}

function buildGrounding(input: {
  name: string
  todayIso: string
  taskSummary: string
  tasks: GroundingEntry[]
  tasksOmitted: number
  followups: GroundingEntry[]
  followupsOmitted: number
  gapDays: string[]
  signalInput: SignalInput
  coverageRefused: boolean
}): string {
  const { signalInput: signals, todayIso } = input

  const header =
    `WORKSPACE FACTS for ${input.name}, ${todayIso} (Asia/Colombo).\n`
    + 'Every line ends with the route that thing lives at. Nothing outside this block is known.'

  const sections: GroundingSection[] = [
    {
      heading: `MY OPEN TASKS [/] — ${input.taskSummary}`,
      lines: entryLines(input.tasks),
      omitted: input.tasksOmitted,
    },
    {
      heading:
        `MY OPEN FOLLOW-UPS OWED [/] — ${signals.followupsOwed} owed`
        + `${signals.oldestOwedDays !== null ? `, oldest open ${signals.oldestOwedDays} days` : ''}`,
      lines: entryLines(input.followups),
      omitted: input.followupsOmitted,
    },
    {
      heading: input.coverageRefused
        ? 'MY WORKLOG [/worklog] — coverage not available to this account'
        : `MY WORKLOG [/worklog] — ${input.gapDays.length} working days with no entry in the last ${WORKLOG_WINDOW_DAYS}`,
      lines: input.gapDays.map((day) => `  - no worklog entry for ${day} [/worklog]`),
      omitted: 0,
    },
    {
      heading: `MEETINGS I ATTENDED WITH NO WRITE-UP [/meetings] — ${signals.unwrittenMeetings.length}`,
      lines: entryLines(
        signals.unwrittenMeetings.map((meeting) => ({
          line: `${meeting.title} — ended ${meeting.endedIso}, ${isoDayDiff(todayIso, meeting.endedIso)} days ago`,
          href: `/meetings?open=${meeting.id}`,
        })),
      ),
      omitted: 0,
    },
    {
      heading: `SPRINTS RUNNING NOW [/apps] — ${signals.sprints.length}`,
      lines: entryLines(
        signals.sprints.map((sprint) => ({
          line:
            `${sprint.name} — ends ${sprint.endsOn} (${isoDayDiff(sprint.endsOn, todayIso)} days), `
            + `${sprint.openTasks} of ${sprint.totalTasks} tasks still open`,
          href: `/apps/${sprint.appSlug}?tab=roadmap`,
        })),
      ),
      omitted: 0,
    },
    {
      heading: `TEAM ALLOCATION [/people] — highest ${signals.capacities.length} shown`,
      lines: entryLines(
        signals.capacities.map((person) => ({
          line: `${person.name} — allocated ${person.pct} percent`,
          href: `/people/${person.userId}`,
        })),
      ),
      omitted: 0,
    },
    {
      heading: `QUIETEST APPS [/apps] — quietest ${signals.quietApps.length} shown`,
      lines: entryLines(
        signals.quietApps.map((app) => ({
          line: app.lastActivityIso
            ? `${app.name} — last activity ${app.lastActivityIso}, ${isoDayDiff(todayIso, app.lastActivityIso)} days ago`
            : `${app.name} — nothing has ever been recorded on it`,
          href: `/apps/${app.slug}`,
        })),
      ),
      omitted: 0,
    },
  ]

  return fit(header, sections)
}
