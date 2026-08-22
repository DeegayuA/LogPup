import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  activityLog,
  appRoleHistory,
  assignments,
  dailyWorklogs,
  meetingNoteSegments,
  meetings,
  users,
  worklogEntries,
} from '@/db/schema'
import { can, type Actor } from '@/features/auth/capabilities'
import { commitEvidenceFor } from '@/features/github/evidence'
import { githubConfigured } from '@/features/github/config'
import { approvedAbsenceDays } from '@/features/worklog/absence-queries'
import { isProjectManagerRole, isReviewerRole } from '@/lib/project-roles'
import { workingDayFraction, type WorkingDayFraction } from '@/lib/working-days'
import { LK_TIMEZONE } from '@/lib/lk-holidays'
import {
  corroborateRange,
  findQuietRuns,
  findUnclaimedDays,
  summarize,
  type CorroborationSummary,
  type DayCorroboration,
  type DayInput,
  type QuietRun,
  type UnclaimedDay,
} from './corroborate'
import {
  observationsFromActivity,
  observationsFromSelfScores,
  observationsFromWitnesses,
  type ActivityRow,
  type Observation,
} from './observe'
import { memberScorecard, type MemberScorecard } from './roles/member'
import type { SignalWindow } from './roles/shared'

/**
 * The only file in this feature that touches a database.
 *
 * Everything it produces is handed to the pure modules to decide. That split
 * is what lets the golden test — a tech lead's Tuesday of meetings, reviews
 * and one incident — be pinned without a Postgres anywhere near it, and it is
 * the same split coverage.ts/coverage-queries.ts already established next
 * door.
 *
 * PERMISSION IS THE SYMMETRY RULE MADE CODE. A person always reads their own
 * signals. Anyone else needs `worklog.view` over them — the same gate the
 * coverage surface uses, deliberately, because a scorecard is a strictly
 * stronger claim about somebody than their worklog is and must not be easier
 * to reach.
 */

export type PersonSignals = {
  window: SignalWindow
  days: DayCorroboration[]
  summary: CorroborationSummary
  /** Sustained silence — the only thing here that escalates, and only to a question. */
  quiet: QuietRun[]
  /** Days worked and never logged. Ships together with `quiet`, always. */
  unclaimed: UnclaimedDay[]
}

/** Every Colombo calendar day in `[from, to]`, inclusive. */
export function daysInRange(from: string, to: string): string[] {
  const out: string[] = []
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/** Bucket an instant into its Colombo day, the key every table here shares. */
function colomboDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

function mayRead(actor: Actor, userId: string): boolean {
  if (actor.id === userId) return true
  return can(actor, 'worklog.view') || can(actor, 'worklog.view', { ownerId: userId })
}

export async function getPersonSignals(
  actor: Actor,
  userId: string,
  from: string,
  to: string,
): Promise<PersonSignals | null> {
  if (!mayRead(actor, userId)) return null

  const [person] = await db
    .select({ githubLogin: users.githubLogin })
    .from(users)
    .where(eq(users.id, userId))
  if (!person) return null

  const [minutes, scores, activity, absent, allocation, voice, commits] = await Promise.all([
    db
      .select({ day: worklogEntries.day, minutes: worklogEntries.minutes })
      .from(worklogEntries)
      .where(
        and(
          eq(worklogEntries.userId, userId),
          gte(worklogEntries.day, from),
          lte(worklogEntries.day, to),
          isNull(worklogEntries.deletedAt),
        ),
      ),
    db
      .select({ day: dailyWorklogs.day, note: dailyWorklogs.note, at: dailyWorklogs.updatedAt })
      .from(dailyWorklogs)
      .where(
        and(eq(dailyWorklogs.userId, userId), gte(dailyWorklogs.day, from), lte(dailyWorklogs.day, to)),
      ),
    db
      .select({
        verb: activityLog.verb,
        entityType: activityLog.entityType,
        appId: activityLog.appId,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.actorId, userId),
          gte(activityLog.createdAt, new Date(`${from}T00:00:00+05:30`)),
          lte(activityLog.createdAt, new Date(`${to}T23:59:59.999+05:30`)),
        ),
      ),
    approvedAbsenceDays(userId, from, to),
    db
      .select({ pct: assignments.allocationPct })
      .from(assignments)
      .where(eq(assignments.userId, userId)),
    // Voice turns never reach activity_log — a transcribed speaker turn is a
    // row on the meeting's note timeline, and it is the single strongest
    // evidence this app holds of a working day that closes nothing.
    db
      .select({ at: meetingNoteSegments.createdAt })
      .from(meetingNoteSegments)
      .where(
        and(
          eq(meetingNoteSegments.speakerId, userId),
          eq(meetingNoteSegments.source, 'voice'),
          isNull(meetingNoteSegments.deletedAt),
          gte(meetingNoteSegments.createdAt, new Date(`${from}T00:00:00+05:30`)),
          lte(meetingNoteSegments.createdAt, new Date(`${to}T23:59:59.999+05:30`)),
        ),
      ),
    commitEvidenceFor(userId, new Date(`${from}T00:00:00+05:30`), new Date(`${to}T23:59:59.999+05:30`)),
  ])

  const claimedByDay = new Map<string, number>()
  for (const row of minutes) {
    claimedByDay.set(row.day, (claimedByDay.get(row.day) ?? 0) + row.minutes)
  }

  const allocationPct = allocation.reduce((sum, a) => sum + a.pct, 0)

  const activityRows: ActivityRow[] = activity.map((a) => ({
    actorId: userId,
    verb: a.verb,
    entityType: a.entityType,
    appId: a.appId,
    createdAt: a.createdAt,
    day: colomboDay(a.createdAt),
  }))

  const observations: Observation[] = [
    ...observationsFromActivity(activityRows),
    ...observationsFromWitnesses({
      // authoredAtIso, not the committer stamp: the worklog asks when the work
      // was DONE, and a rebase rewrites the committer date but not the
      // author's. commits.ts already made that ruling for the AI draft — this
      // reads the same field rather than a second opinion about it.
      commits: commits.map((c) => ({
        userId,
        day: colomboDay(new Date(c.authoredAtIso)),
        appId: null,
        at: new Date(c.authoredAtIso),
      })),
      voiceTurns: voice.map((v) => ({
        userId,
        day: colomboDay(v.at),
        appId: null,
        at: v.at,
      })),
    }),
    ...observationsFromSelfScores(
      scores.map((s) => ({ userId, day: s.day, note: s.note, at: s.at })),
    ),
  ]

  const dayInputs: DayInput[] = daysInRange(from, to).map((day) => ({
    userId,
    day,
    claimedMinutes: claimedByDay.get(day) ?? 0,
    onLeave: absent.has(day),
    // Gazetted mercantile holidays only, matching working-days.ts's default.
    // Company shutdown days compose on top of it elsewhere; wiring that here
    // is a follow-up, and until it lands a company holiday reads as a normal
    // working day rather than as leave — which errs toward asking a question,
    // never toward a silent accusation.
    workingFraction: workingDayFraction(day) as WorkingDayFraction,
    allocationPct,
  }))

  const days = corroborateRange(dayInputs, observations)
  return {
    window: {
      from,
      to,
      workingDays: dayInputs.reduce(
        (sum, d) => sum + (d.onLeave ? 0 : d.workingFraction),
        0,
      ),
    },
    days,
    summary: summarize(days),
    quiet: findQuietRuns(days),
    unclaimed: findUnclaimedDays(days),
  }
}

export type HeldRole = 'pm' | 'lead' | 'architect' | 'member'

/**
 * Which roles this person actually held during the window.
 *
 * PM and lead come from `app_role_history`'s half-open intervals, so the
 * answer is "did they hold it AT ANY POINT IN THIS WINDOW" rather than "do
 * they hold it now" — fairness rule 1. Somebody who handed a project over in
 * March is not measured as its PM in August, and somebody who took one on last
 * week is not answerable for a deadline agreed before they arrived.
 *
 * Architect is derived from the free text in `assignments.role` through the
 * shared patterns in project-roles.ts. Deliberately the same function the UI
 * badge and the permission check use — a private copy of "who counts as a
 * reviewer" is how the badge and the scorecard end up disagreeing about
 * somebody's job.
 */
export async function heldRoles(userId: string, from: string, to: string): Promise<HeldRole[]> {
  const windowStart = new Date(`${from}T00:00:00+05:30`)
  const windowEnd = new Date(`${to}T23:59:59.999+05:30`)

  const [history, projectRoles] = await Promise.all([
    db
      .select({ role: appRoleHistory.role })
      .from(appRoleHistory)
      .where(
        and(
          eq(appRoleHistory.userId, userId),
          lte(appRoleHistory.effectiveFrom, windowEnd),
          sql`(${appRoleHistory.effectiveTo} is null or ${appRoleHistory.effectiveTo} >= ${windowStart})`,
        ),
      ),
    db.select({ role: assignments.role }).from(assignments).where(eq(assignments.userId, userId)),
  ])

  const roles = new Set<HeldRole>(['member'])
  for (const row of history) {
    if (row.role === 'pm') roles.add('pm')
    if (row.role === 'lead') roles.add('lead')
  }
  for (const row of projectRoles) {
    if (isProjectManagerRole(row.role)) roles.add('pm')
    if (isReviewerRole(row.role)) roles.add('architect')
  }
  return [...roles]
}

/**
 * The IC card, which everybody gets regardless of what else they hold.
 *
 * A tech lead is still somebody with tasks of their own, and dropping this
 * card for anyone senior would hide exactly the figure — personal cycle time —
 * that says whether they are still able to finish anything themselves.
 */
export async function getMemberScorecard(
  actor: Actor,
  userId: string,
  from: string,
  to: string,
): Promise<MemberScorecard | null> {
  const signals = await getPersonSignals(actor, userId, from, to)
  if (!signals) return null

  const [person] = await db
    .select({ githubLogin: users.githubLogin })
    .from(users)
    .where(eq(users.id, userId))

  const [completions, categories, allocation, commits] = await Promise.all([
    db
      .select({ createdAt: sql<Date>`t.created_at`, completedAt: sql<Date>`t.completed_at` })
      .from(sql`tasks t`)
      .where(
        sql`t.assignee_id = ${userId} and t.deleted_at is null and t.completed_at is not null
            and t.completed_at >= ${new Date(`${from}T00:00:00+05:30`)}
            and t.completed_at <= ${new Date(`${to}T23:59:59.999+05:30`)}`,
      ),
    db
      .select({
        category: worklogEntries.category,
        minutes: sql<number>`sum(${worklogEntries.minutes})::int`,
      })
      .from(worklogEntries)
      .where(
        and(
          eq(worklogEntries.userId, userId),
          gte(worklogEntries.day, from),
          lte(worklogEntries.day, to),
          isNull(worklogEntries.deletedAt),
        ),
      )
      .groupBy(worklogEntries.category),
    db.select({ pct: assignments.allocationPct }).from(assignments).where(eq(assignments.userId, userId)),
    commitEvidenceFor(userId, new Date(`${from}T00:00:00+05:30`), new Date(`${to}T23:59:59.999+05:30`)),
  ])

  const minutesByCategory: Record<string, number> = {}
  for (const row of categories) minutesByCategory[row.category] = row.minutes

  // null, never 0, when this app simply cannot see their code. "Wrote no code"
  // and "we cannot see their code" are different sentences about a person.
  const canSeeCommits = githubConfigured() && Boolean(person?.githubLogin)

  return memberScorecard({
    userId,
    window: signals.window,
    completions: completions.map((c) => ({
      createdAt: new Date(c.createdAt),
      completedAt: new Date(c.completedAt),
    })),
    commits: canSeeCommits ? commits.length : null,
    commitsUnavailable: canSeeCommits
      ? null
      : githubConfigured()
        ? 'No GitHub account linked — add your username on /profile.'
        : 'This workspace has no GitHub App configured.',
    minutesByCategory,
    // 480 minutes per full working day, the studio default in schedules.ts.
    expectedMinutes: Math.round(signals.window.workingDays * 480),
    allocationPct: allocation.reduce((sum, a) => sum + a.pct, 0),
  })
}

/** Unused-import guard for tables referenced only through raw SQL above. */
void meetings
void inArray
