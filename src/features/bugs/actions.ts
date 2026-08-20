'use server'

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { bugReports } from '@/db/schema'
import { liveApps } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { revalidateAdmin } from '@/lib/revalidate-admin'
import { logActivity } from '@/features/activity/log'
import {
  bugReportInput,
  bugTriageInput,
  type BugReportInput,
  type BugTriageInput,
} from '@/features/bugs/report-input'
import {
  bugSeverityLabel,
  bugStatusLabel,
  isSettledBugStatus,
} from '@/features/bugs/bug-display'
import { getBugScope } from '@/features/bugs/queries'

/**
 * The three things a person can do to a bug report.
 *
 * WHY EVERY ONE OF THESE READS THE BUG BEFORE IT CHECKS PERMISSION.
 * `bug.view`, `bug.triage` and `bug.delete` are SCOPED grants for manager and
 * editor, and a scoped grant asked without its resource fails closed
 * (capabilities.ts, `can`). The resource here is the project, which is a
 * column on the bug — so the appId has to be in hand before the question can
 * be asked at all. `getBugScope` is one indexed row for exactly that, and it
 * reads through the live subqueries, so a trashed bug or a trashed project
 * answers "not found" before any permission question is reached.
 *
 * Writes go to the raw `bugReports` table on purpose: db/live.test.ts guards
 * READS, and an UPDATE that had to route through a subquery could not set
 * anything.
 */

/** Every route whose content a bug write changes. */
function revalidateBug(appSlug: string): void {
  revalidatePath(`/apps/${appSlug}`)
  revalidatePath('/admin/bugs')
  revalidateAdmin()
}

function unexpected(context: string, error: unknown): ActionResult<never> {
  // A server action never throws — it returns err(). See the same helper in
  // sprints/task-actions.ts for why: a rejected promise is the one outcome a
  // caller cannot render, and the person is told nothing at all.
  console.error(`[bugs] ${context}`, error)
  return err('Something went wrong — try again')
}

/**
 * File a bug.
 *
 * `bug.report` is granted 'all' from member up, so this gate needs no
 * resource — deliberately: the person best placed to report a break is often
 * someone outside the project who tripped over it, and a scoped gate here
 * would silence exactly them (see the ROLE_GRANTS comment).
 *
 * The refusal says 'Not allowed' rather than the house 'Admins only' string,
 * because the only seats it can refuse are stakeholder, auditor and signed
 * out — for whom "admins only" would be plainly untrue.
 */
export async function reportBug(input: BugReportInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requireCapability('bug.report')
  if (!actor) return err('Not allowed')

  const parsed = bugReportInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid bug report')
  const { appId, title, description, pagePath } = parsed.data

  try {
    // Through liveApps: filing against a trashed project would create a row
    // nothing can ever show, because every read joins the live project back.
    const [app] = await db
      .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug })
      .from(liveApps)
      .where(eq(liveApps.id, appId))
      .limit(1)
    if (!app) return err('App not found')

    const [created] = await db
      .insert(bugReports)
      // No severity: the reporter describes, the triager rates. The column
      // default ('medium') is what stands until somebody decides otherwise.
      .values({ appId: app.id, title, description, pagePath: pagePath ?? null, reportedBy: actor.id })
      .returning({ id: bugReports.id })
    if (!created) return err('Could not file the bug — try again')

    await logActivity({
      actorId: actor.id,
      verb: 'created',
      entityType: 'bug',
      entityId: created.id,
      entityLabel: title,
      appId: app.id,
      appName: app.name,
      // The bug lives on its project's tab; that is where a reader of the
      // trail wants to land.
      pagePath: `/apps/${app.slug}?tab=bugs`,
      detail: pagePath ? `reported from ${pagePath}` : null,
      metadata: pagePath ? { pagePath } : null,
    })
    revalidateBug(app.slug)
    return ok({ id: created.id })
  } catch (error) {
    return unexpected('reportBug failed:', error)
  }
}

/**
 * Set a bug's status, severity or assignee.
 *
 * One action rather than three, because the three move together in practice —
 * "this is critical, I'm taking it, it's in progress" is one decision — and
 * three actions would write three activity rows for it.
 */
export async function triageBug(input: BugTriageInput): Promise<ActionResult> {
  const parsed = bugTriageInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Nothing to change')
  const { bugId, status, severity, assignedTo } = parsed.data

  const scope = await getBugScope(bugId)
  if (!scope) return err('Bug not found')

  const actor = await requireCapability('bug.triage', { appId: scope.appId })
  if (!actor) return err('Admins only')

  try {
    const set: Partial<typeof bugReports.$inferInsert> = { updatedAt: new Date() }
    if (severity !== undefined) set.severity = severity
    if (assignedTo !== undefined) set.assignedTo = assignedTo
    if (status !== undefined) {
      set.status = status
      // resolvedAt is derived from the status, never set by hand: the two
      // disagreeing is how a "resolved" list ends up with rows that were
      // never resolved and a reopened bug keeps a resolution date from the
      // last time somebody closed it. Reopening clears it.
      set.resolvedAt = isSettledBugStatus(status) ? new Date() : null
    }

    const [updated] = await db
      .update(bugReports)
      // `isNull(deletedAt)` in the WHERE, not just the id: triaging a trashed
      // bug would otherwise resurrect it into every open-bug count without
      // undeleting it anywhere a person can see.
      .set(set)
      .where(and(eq(bugReports.id, bugId), isNull(bugReports.deletedAt)))
      .returning({ id: bugReports.id })
    if (!updated) return err('Bug not found')

    // "triaged bug · Login loop" — the phrase names the project and the
    // defect and never the person who wrote the code. A bug attributed to a
    // person, even indirectly, is how a team stops filing them.
    const changes = [
      status !== undefined ? `status to ${bugStatusLabel(status)}` : null,
      severity !== undefined ? `severity to ${bugSeverityLabel(severity)}` : null,
      assignedTo !== undefined ? (assignedTo ? 'assigned' : 'unassigned') : null,
    ].filter((part): part is string => part !== null)

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'bug',
      entityId: bugId,
      entityLabel: scope.title,
      appId: scope.appId,
      appName: scope.appName,
      pagePath: `/apps/${scope.appSlug}?tab=bugs`,
      detail: changes.join(', '),
      metadata: {
        ...(status !== undefined ? { status: { from: scope.status, to: status } } : {}),
        ...(severity !== undefined ? { severity: { to: severity } } : {}),
        ...(assignedTo !== undefined ? { assignedTo: { to: assignedTo } } : {}),
      },
    })
    revalidateBug(scope.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('triageBug failed:', error)
  }
}

/**
 * Move a bug to the trash. SOFT — the row keeps existing, `deletedAt` and
 * `deletedBy` record who ended it, and every read stops seeing it because
 * every read goes through liveBugReports. Hard deletes of a soft-deletable
 * row live in admin/trash-actions.ts and nowhere else.
 */
export async function deleteBug(bugId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(bugId).success) return err('Bug not found')

  const scope = await getBugScope(bugId)
  if (!scope) return err('Bug not found')

  const actor = await requireCapability('bug.delete', { appId: scope.appId })
  if (!actor) return err('Admins only')

  try {
    const [deleted] = await db
      .update(bugReports)
      .set({ deletedAt: new Date(), deletedBy: actor.id })
      // Same `isNull` reasoning as deleteApp: deleting an already-trashed row
      // would overwrite the record of who removed it and when.
      .where(and(eq(bugReports.id, bugId), isNull(bugReports.deletedAt)))
      .returning({ id: bugReports.id })
    if (!deleted) return err('Bug not found, or it was already deleted')

    await logActivity({
      actorId: actor.id,
      verb: 'deleted',
      entityType: 'bug',
      entityId: bugId,
      entityLabel: scope.title,
      appId: scope.appId,
      appName: scope.appName,
      pagePath: `/apps/${scope.appSlug}?tab=bugs`,
      detail: 'moved to trash',
    })
    revalidateBug(scope.appSlug)
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteBug failed:', error)
  }
}
