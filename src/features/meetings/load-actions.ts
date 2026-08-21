'use server'

import { and, eq, inArray, isNotNull, lt, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { liveApps, liveMeetings, liveTasks } from '@/db/live'
import { meetingApps, meetingFollowups, meetingLoadDecisions, users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { can, type UserRole } from '@/features/auth/capabilities'
import { managesAnyApp } from '@/features/apps/project-manager'
import { canHoldWork } from '@/features/people/removal-queries'
import { approvedAbsenceUserIds } from '@/features/worklog/absence-queries'
import { boardHref } from '@/features/apps/tabs'
import { overdueAskText, overdueRowsByUserApp, stalledAskText } from '@/features/meetings/ask-derivation'
import { purposeToken } from '@/features/meetings/series-key'
import { coverAsks, type CoverAsk, type CoverageGroup } from '@/features/meetings/coverage'

/**
 * The read and the two writes behind /meetings/load.
 *
 * DERIVATION, NEVER A STORED LIST. Open suggestions are computed on every
 * render from live rows; only DECISIONS are stored. A written-down suggestion
 * starts rotting the moment it is saved — the follow-up gets answered, the
 * task gets ticked, the deadline moves — and a stale suggestion is worse than
 * none. This is planner.ts's doctrine, and it carries over unchanged.
 *
 * SUGGESTIONS, NEVER INVITES. Nothing here writes `meeting_attendees`.
 * Accepting a group opens a prefilled meeting form and a human presses save.
 * The only writes in this file are decision rows.
 *
 * BATCHED. The query count is FIXED — it does not grow with the number of
 * asks, people or projects. Two waves: everything that can be asked at once,
 * then the one lookup keyed by what the first wave returned.
 */

/** The only decision kind this file writes. R1-R5 add their own later; the
 *  column is text precisely so they cost no migration. */
const COVER_TOGETHER = 'cover_together'

/**
 * How far ahead "away" is checked.
 *
 * A working week. The proposal names no day (there is no free/busy in this
 * product), so the honest question is not "is this person free on Tuesday" but
 * "is this person here at all in the span where this meeting would land".
 */
const AWAY_WINDOW_DAYS = 7

/** What the board renders. Names are resolved here, once, so no component has
 *  to hold a map of user ids — and so a card can never print a raw uuid. */
export type LoadPerson = { id: string; name: string }

export type LoadSuggestion = {
  targetKey: string
  kind: typeof COVER_TOGETHER
  appId: string | null
  appName: string | null
  required: LoadPerson[]
  optional: LoadPerson[]
  items: { id: string; text: string; href: string; pinned: boolean }[]
  minutes: number
  savedPersonMinutes: number
  pinnedCount: number
  notBefore: string
  /** One line per ask, ready to drop into the meeting form's agenda field. */
  agenda: string
}

export type MeetingLoadBoard = {
  suggestions: LoadSuggestion[]
  /** The finding in words, for a button that reports its own answer. Null when
   *  there is nothing to report. */
  headline: string | null
  /** How many suggestions were suppressed because somebody already decided
   *  them. Shown as a count, never as a list — the dismissed list is admin
   *  territory. */
  dismissedCount: number
}

const isoDayAdd = (iso: string, days: number) => {
  const cursor = new Date(`${iso}T12:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return cursor.toISOString().slice(0, 10)
}

/**
 * Who may read the sweep.
 *
 * These cards lay out named people's unanswered questions and broken promises
 * across every project at once, which is strictly more than any single
 * meeting's planner shows. So the gate is the planner's, widened the only way
 * that makes sense without a meeting to scope it to: whoever the capability
 * layer trusts with meeting intel outright, or anyone who actually runs a
 * project. A member with no project does not get a workspace-wide reading of
 * everybody else's late work.
 */
async function canReadLoadBoard(
  user: { id: string; role?: string | null },
  appIds: readonly string[],
): Promise<boolean> {
  const actor = {
    id: user.id,
    role: (user.role ?? 'member') as UserRole,
    scopeAppIds: new Set<string>() as ReadonlySet<string>,
  }
  if (can(actor, 'meeting.intel.view')) return true
  return managesAnyApp(user.id, appIds)
}

/**
 * The board: every group R6 can propose, minus the ones already decided.
 */
export async function getMeetingLoadSuggestions(): Promise<ActionResult<MeetingLoadBoard>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const todayIso = toIsoDateInTimeZone(new Date())
  const windowEnd = isoDayAdd(todayIso, AWAY_WINDOW_DAYS)

  // --- wave 1 --------------------------------------------------------------
  const [appRows, people, decisions, awayIds, followupRows, overdueTaskRows, stalledTaskRows] =
    await Promise.all([
      db
        .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug, pmId: liveApps.pmId, leadId: liveApps.leadId })
        .from(liveApps),
      // `canHoldWork()`, not `active && approved`: the question is "may this
      // person be handed work", and getTeamForApp does NOT filter deactivated
      // or removed users, so anything built off it would propose a meeting
      // with somebody who has left.
      db.select({ id: users.id, name: users.name }).from(users).where(canHoldWork()),
      db
        .select({ targetKey: meetingLoadDecisions.targetKey })
        .from(meetingLoadDecisions)
        .where(eq(meetingLoadDecisions.kind, COVER_TOGETHER)),
      approvedAbsenceUserIds(todayIso, windowEnd),
      // Open follow-ups with BOTH ends resolved to accounts. A follow-up is one
      // person owing an answer to another; a row missing either end is a status
      // update, not a decision, and cannot be covered.
      db
        .select({
          id: meetingFollowups.id,
          userId: meetingFollowups.userId,
          createdBy: meetingFollowups.createdBy,
          text: meetingFollowups.text,
          sourceMeetingId: meetingFollowups.sourceMeetingId,
          sourceTitle: liveMeetings.title,
          targetMeetingId: meetingFollowups.targetMeetingId,
        })
        .from(meetingFollowups)
        // meeting_followups carries no deletedAt of its own (MEETING_CHILD_TABLES
        // in src/db/live.ts) — the join against liveMeetings is what stops a
        // trashed meeting's follow-ups reading.
        .innerJoin(liveMeetings, eq(meetingFollowups.sourceMeetingId, liveMeetings.id))
        .where(and(
          eq(meetingFollowups.status, 'open'),
          isNotNull(meetingFollowups.userId),
          isNotNull(meetingFollowups.createdBy),
        )),
      // A slipping COMMITTED deadline only. A target that slips is information;
      // only a commitment is a promise somebody made to somebody, and only a
      // promise is worth a room.
      db
        .select({
          id: liveTasks.id, appId: liveTasks.appId, sprintId: liveTasks.sprintId,
          assigneeId: liveTasks.assigneeId, status: liveTasks.status, dueDate: liveTasks.dueDate,
        })
        .from(liveTasks)
        .where(and(
          eq(liveTasks.dueKind, 'committed'),
          isNotNull(liveTasks.dueDate),
          lt(liveTasks.dueDate, todayIso),
          ne(liveTasks.status, 'done'),
          isNotNull(liveTasks.assigneeId),
        )),
      // Started, past its date, still not finished — the honest stand-in for
      // "blocked", since task_status has no such state (see ask-derivation.ts).
      db
        .select({
          id: liveTasks.id, appId: liveTasks.appId, sprintId: liveTasks.sprintId,
          assigneeId: liveTasks.assigneeId, status: liveTasks.status, dueDate: liveTasks.dueDate,
        })
        .from(liveTasks)
        .where(and(
          eq(liveTasks.status, 'in_progress'),
          isNotNull(liveTasks.dueDate),
          lt(liveTasks.dueDate, todayIso),
          isNotNull(liveTasks.assigneeId),
        )),
    ])

  if (!(await canReadLoadBoard(session.user, appRows.map((app) => app.id)))) {
    return err('Not available')
  }

  // --- wave 2: the source meetings' projects -------------------------------
  // Keyed by what wave 1 returned, which is the only reason it is not in it.
  const sourceIds = [...new Set(followupRows.map((row) => row.sourceMeetingId))]
  const sourceAppRows = sourceIds.length === 0
    ? []
    : await db
      .select({ meetingId: meetingApps.meetingId, appId: meetingApps.appId })
      .from(meetingApps)
      .innerJoin(liveMeetings, eq(meetingApps.meetingId, liveMeetings.id))
      .where(inArray(meetingApps.meetingId, sourceIds))

  const appsById = new Map(appRows.map((app) => [app.id, app]))
  const nameById = new Map(people.map((person) => [person.id, person.name]))
  const decided = new Set(decisions.map((row) => row.targetKey))
  const appsByMeeting = new Map<string, string[]>()
  for (const row of sourceAppRows) {
    appsByMeeting.set(row.meetingId, [...(appsByMeeting.get(row.meetingId) ?? []), row.appId])
  }

  // --- the asks ------------------------------------------------------------
  const asks: CoverAsk[] = []

  for (const row of followupRows) {
    const sharedApps = appsByMeeting.get(row.sourceMeetingId) ?? []
    asks.push({
      id: `followup:${row.id}`,
      kind: 'followup',
      // One project only when the source meeting names exactly one. With
      // several there is no defensible single project to file it under.
      appId: sharedApps.length === 1 ? sharedApps[0] : null,
      text: row.text,
      href: `/print/meetings/${row.sourceMeetingId}`,
      required: [row.userId!, row.createdBy!],
      optional: [],
      // The strongest "needs a conversation" flag in the schema: somebody
      // already said out loud that this belongs in a meeting.
      pinned: row.targetMeetingId !== null,
      // What KIND of conversation it was carried out of. A retro's open item
      // never joins a standup, however identical the people are.
      purpose: purposeToken(row.sourceTitle),
    })
  }

  const liveAppIds = new Set(appRows.map((app) => app.id))
  const overdueRows = overdueRowsByUserApp(overdueTaskRows, todayIso, (id) => liveAppIds.has(id))
  for (const { userId, appId, count } of overdueRows) {
    const app = appsById.get(appId)
    if (!app) continue
    asks.push({
      id: `overdue:${userId}:${appId}`,
      kind: 'overdue',
      appId,
      text: overdueAskText(count, app.name),
      href: boardHref(app.slug, null, { who: userId, overdue: '1' }),
      // A broken promise is a conversation with whoever it was promised to,
      // and the PM is who the studio promised on that project's behalf.
      required: [userId, app.pmId],
      // A lead is a busy reviewer, never a reason to enlarge the room.
      optional: app.leadId ? [app.leadId] : [],
      pinned: false,
      purpose: null,
    })
  }

  const stalledRows = overdueRowsByUserApp(stalledTaskRows, todayIso, (id) => liveAppIds.has(id))
  for (const { userId, appId, count } of stalledRows) {
    const app = appsById.get(appId)
    if (!app) continue
    asks.push({
      id: `stalled:${userId}:${appId}`,
      kind: 'stalled',
      appId,
      text: stalledAskText(count, app.name),
      href: boardHref(app.slug, null, { who: userId, overdue: '1' }),
      required: [userId, app.pmId],
      optional: app.leadId ? [app.leadId] : [],
      pinned: false,
      purpose: null,
    })
  }

  // --- the cover -----------------------------------------------------------
  const eligible = people.map((person) => person.id).filter((id) => !awayIds.has(id))
  const plan = coverAsks({ asks, eligible, todayIso })

  const open = plan.groups.filter((group) => !decided.has(group.targetKey))
  const person = (id: string): LoadPerson => ({ id, name: nameById.get(id) ?? 'Someone' })

  const suggestions: LoadSuggestion[] = open.map((group) => ({
    targetKey: group.targetKey,
    kind: COVER_TOGETHER,
    appId: group.appId,
    appName: group.appId ? (appsById.get(group.appId)?.name ?? null) : null,
    required: group.required.map(person),
    optional: group.optional.map(person),
    items: group.asks.map((ask) => ({
      id: ask.id, text: ask.text, href: ask.href, pinned: ask.pinned,
    })),
    minutes: group.minutes,
    savedPersonMinutes: group.savedPersonMinutes,
    pinnedCount: group.pinnedCount,
    notBefore: group.notBefore,
    agenda: group.asks.map((ask) => `- ${ask.text}`).join('\n'),
  }))

  return ok({
    suggestions,
    headline: headlineFor(open),
    dismissedCount: plan.groups.length - open.length,
  })
}

/** The finding, counting only what is still OPEN — a headline that included
 *  dismissed groups would advertise a saving the page does not offer. */
function headlineFor(open: readonly CoverageGroup[]): string | null {
  if (open.length === 0) return null
  const covered = open.reduce((sum, group) => sum + group.asks.length, 0)
  return `${covered} meetings could be ${open.length}`
}

/**
 * Dismiss a suggestion, for good.
 *
 * The unique index on (kind, target_key) plus the renderer's decided-keys
 * filter IS the never-re-show guarantee; this row is what arms it. `evidence`
 * snapshots the numbers that were on screen — ids only, never names, so a
 * dismissed group does not become a place somebody's name is kept after they
 * have gone.
 *
 * Idempotent by design: a second dismissal of the same key is the same answer,
 * not an error a person should have to read.
 */
export async function dismissSuggestion(
  targetKey: string,
  evidence: { askIds: string[]; requiredIds: string[]; minutes: number; savedPersonMinutes: number },
): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const appIds = await db.select({ id: liveApps.id }).from(liveApps)
  if (!(await canReadLoadBoard(session.user, appIds.map((app) => app.id)))) {
    return err('Not available')
  }
  if (!targetKey.startsWith('cover:')) return err('Unknown suggestion')

  await db
    .insert(meetingLoadDecisions)
    .values({
      kind: COVER_TOGETHER,
      targetKey,
      status: 'dismissed',
      evidence,
      decidedBy: session.user.id,
    })
    .onConflictDoNothing({
      target: [meetingLoadDecisions.kind, meetingLoadDecisions.targetKey],
    })

  revalidatePath('/meetings/load')
  revalidatePath('/meetings')
  return ok(undefined)
}

/**
 * The only path back: delete the decision so the live engine may re-derive the
 * suggestion.
 *
 * ADMIN ONLY, and a genuine hard delete rather than a soft one — the row IS
 * the suppression, so marking it deleted and leaving it in place would
 * suppress the suggestion forever, which is the opposite of reopening it.
 * Nothing is lost that the sweep cannot compute again from live rows.
 */
export async function reopenLoadDecision(targetKey: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const actor = {
    id: session.user.id,
    role: (session.user.role ?? 'member') as UserRole,
    scopeAppIds: new Set<string>() as ReadonlySet<string>,
  }
  // Not `canReadLoadBoard`: reading the board and overruling somebody else's
  // dismissal are different powers, and the engine puts Reopen on /admin.
  if (!can(actor, 'meeting.intel.view')) return err('Not available')

  await db
    .delete(meetingLoadDecisions)
    .where(and(
      eq(meetingLoadDecisions.kind, COVER_TOGETHER),
      eq(meetingLoadDecisions.targetKey, targetKey),
    ))

  revalidatePath('/meetings/load')
  return ok(undefined)
}
