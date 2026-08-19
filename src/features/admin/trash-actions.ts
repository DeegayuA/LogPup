'use server'

// trash: the one place besides trash-queries.ts that legitimately reads
// deletedAt IS NOT NULL rows — and the only place that ever hard-deletes a
// soft-deleted table. Pre-allowlisted by path in src/db/live.test.ts (checks
// 1/2/4).

import { z } from 'zod'
import { and, count, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { del } from '@vercel/blob'
import { db } from '@/db'
import { liveScreenshots } from '@/db/live'
import {
  apps,
  assignmentHistory,
  assignments,
  meetingNoteSegments,
  meetingScreenshots,
  meetings,
  sprints,
  tasks,
  users,
} from '@/db/schema'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { keyframeDeleteLabel, noteSegmentDeleteLabel } from '@/features/meetings/note-labels'
import { MAX_KEYFRAMES_PER_MEETING } from '@/features/meetings/screen-keyframes'
import { PURGE_CONFIRM_PHRASE } from '@/features/admin/components/trash-card-logic'

// ONE phrase, defined in trash-card-logic.ts and imported here — not two
// literals that happen to match today. Drift between them breaks purge
// silently in one of two directions: a stricter server phrase means the
// dialog enables its button on text the action then rejects, and a stricter
// client phrase means the typed confirm no longer gates anything the server
// cares about. The import direction is forced: this is a 'use server' module,
// which may only export async functions, so the constant cannot live here.
// trash-card-logic.ts is a plain (non-'use client') pure module, so importing
// from it here is free.
const CONFIRM_PHRASE = PURGE_CONFIRM_PHRASE

// Was a verbatim copy of the same six-line `requireAdmin()` that lived in six
// other files. Every guard now names the capability it needs and the matrix
// answers; the contract is unchanged (Actor on success, null on refusal).

async function appNameById(appId: string | null): Promise<string | null> {
  if (!appId) return null
  const [app] = await db.select({ name: apps.name }).from(apps).where(eq(apps.id, appId))
  return app?.name ?? null
}

async function slugForApp(appId: string | null): Promise<string | null> {
  if (!appId) return null
  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId))
  return app?.slug ?? null
}

async function nameForUser(userId: string): Promise<string | null> {
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId))
  return user?.name ?? null
}

/**
 * Walks an error's `.cause` chain looking for a Postgres unique-violation.
 * Same shape as the copy in src/features/people/actions.ts — duplicated
 * rather than imported so this file stays self-contained and doesn't reach
 * into another feature's private helpers for ten lines of cause-chain
 * walking.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (e.code === '23505') return true
    if (typeof e.message === 'string' && e.message.includes('duplicate key')) return true
    current = e.cause
  }
  return false
}

/**
 * The two pages EVERY restore/purge changes, no matter what it acted on:
 * /admin (the Trash card just lost a row) and / (the dashboard's activity
 * feed just gained a 'restored'/'purged' row — logActivity is called by all
 * eleven actions in this file). Every other helper below composes this one,
 * so an action added later cannot forget either of them.
 */
function revalidateTrashPaths() {
  revalidatePath('/admin')
  revalidatePath('/')
}

async function revalidateMeetingTrashPaths(appId: string | null) {
  const slug = await slugForApp(appId)
  if (slug) revalidatePath('/apps/' + slug)
  revalidatePath('/meetings')
  revalidateTrashPaths()
}

async function revalidateAppEntityTrashPaths(appId: string) {
  const slug = await slugForApp(appId)
  if (slug) revalidatePath('/apps/' + slug)
  revalidateTrashPaths()
}

function revalidateAssignmentTrashPaths(slug: string | null, userId: string) {
  if (slug) revalidatePath('/apps/' + slug)
  revalidatePath('/people')
  revalidatePath('/people/' + userId)
  revalidatePath('/people/history')
  revalidateTrashPaths()
}

const uuidInput = z.uuid()

// ===========================================================================
// RESTORES
// ===========================================================================

/**
 * Un-trashes a meeting. googleEventId is deliberately NULLED, not carried
 * over: the guest invites for the old event were already cancelled/deleted
 * the moment the meeting was soft-deleted (see deleteMeeting in
 * src/features/meetings/actions.ts), so the id on the row would point at an
 * event that no longer exists. A restored meeting therefore comes back with
 * no calendar invite at all — the warning below points the organiser at
 * "Add to calendar" (the .ics path), which works unconditionally and is the
 * only way to get guests a fresh invite.
 */
export async function restoreMeeting(meetingId: string): Promise<ActionResult<{ warning: string }>> {
  const actor = await requireCapability('trash.restore')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(meetingId)
  if (!parsedId.success) return err('Invalid meeting')

  const restored = await db
    .update(meetings)
    .set({ deletedAt: null, deletedBy: null, googleEventId: null })
    .where(and(eq(meetings.id, parsedId.data), isNotNull(meetings.deletedAt)))
    .returning({ id: meetings.id, title: meetings.title, appId: meetings.appId })
  if (restored.length === 0) return err('Not found, or it was already restored')
  const [row] = restored

  await logActivity({
    actorId: actor.id,
    verb: 'restored',
    entityType: 'meeting',
    entityId: row.id,
    entityLabel: row.title,
    appId: row.appId,
    appName: await appNameById(row.appId),
    pagePath: '/meetings',
  })
  await revalidateMeetingTrashPaths(row.appId)
  return ok({
    warning:
      'The calendar invite was cancelled when this meeting was deleted and is not re-sent — '
      + 'use “Add to calendar” on the meeting to send guests a fresh one.',
  })
}

export async function restoreTask(taskId: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.restore')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(taskId)
  if (!parsedId.success) return err('Invalid task')

  const restored = await db
    .update(tasks)
    .set({ deletedAt: null, deletedBy: null })
    .where(and(eq(tasks.id, parsedId.data), isNotNull(tasks.deletedAt)))
    .returning({ id: tasks.id, title: tasks.title, appId: tasks.appId })
  if (restored.length === 0) return err('Not found, or it was already restored')
  const [row] = restored

  // Same shape as deleteTask's own logActivity call (task-actions.ts): no
  // appName/pagePath — tasks don't carry one there either.
  await logActivity({
    actorId: actor.id,
    verb: 'restored',
    entityType: 'task',
    entityId: row.id,
    entityLabel: row.title,
    appId: row.appId,
  })
  await revalidateAppEntityTrashPaths(row.appId)
  return ok(undefined)
}

export async function restoreSprint(sprintId: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.restore')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(sprintId)
  if (!parsedId.success) return err('Invalid sprint')

  const restored = await db
    .update(sprints)
    .set({ deletedAt: null, deletedBy: null })
    .where(and(eq(sprints.id, parsedId.data), isNotNull(sprints.deletedAt)))
    .returning({ id: sprints.id, name: sprints.name, appId: sprints.appId })
  if (restored.length === 0) return err('Not found, or it was already restored')
  const [row] = restored

  // Same shape as deleteSprint/updateSprintStatus's own logActivity calls
  // (sprints/actions.ts): a single slug lookup feeds pagePath, no appName.
  const slug = await slugForApp(row.appId)
  await logActivity({
    actorId: actor.id,
    verb: 'restored',
    entityType: 'sprint',
    entityId: row.id,
    entityLabel: row.name,
    appId: row.appId,
    pagePath: slug ? '/apps/' + slug : null,
  })
  if (slug) revalidatePath('/apps/' + slug)
  revalidateTrashPaths()
  return ok(undefined)
}

export async function restoreSegment(segmentId: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.restore')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(segmentId)
  if (!parsedId.success) return err('Invalid note')

  const [existing] = await db
    .select({
      meetingId: meetingNoteSegments.meetingId,
      meetingTitle: meetings.title,
      meetingDeletedAt: meetings.deletedAt,
    })
    .from(meetingNoteSegments)
    .innerJoin(meetings, eq(meetingNoteSegments.meetingId, meetings.id))
    .where(and(eq(meetingNoteSegments.id, parsedId.data), isNotNull(meetingNoteSegments.deletedAt)))
  if (!existing) return err('Not found, or it was already restored')
  if (existing.meetingDeletedAt !== null) return err('Restore the meeting first')

  // Same check-then-write tradeoff as setUserRole/setUserActive in
  // src/features/admin/actions.ts: not atomic with the read above, but this
  // is an admin-only tool and the exploitable window (the meeting getting
  // trashed in the instant between the check and this write) is essentially
  // nothing in practice.
  const restored = await db
    .update(meetingNoteSegments)
    .set({ deletedAt: null, deletedBy: null })
    .where(and(eq(meetingNoteSegments.id, parsedId.data), isNotNull(meetingNoteSegments.deletedAt)))
    .returning({ id: meetingNoteSegments.id })
  if (restored.length === 0) return err('Not found, or it was already restored')

  await logActivity({
    actorId: actor.id,
    verb: 'restored',
    entityType: 'meeting',
    entityId: existing.meetingId,
    entityLabel: noteSegmentDeleteLabel(existing.meetingTitle),
    pagePath: '/meetings',
  })
  revalidatePath('/meetings')
  revalidateTrashPaths()
  return ok(undefined)
}

export async function restoreKeyframe(screenshotId: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.restore')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(screenshotId)
  if (!parsedId.success) return err('Invalid screenshot')

  const [existing] = await db
    .select({
      meetingId: meetingScreenshots.meetingId,
      meetingTitle: meetings.title,
      meetingDeletedAt: meetings.deletedAt,
    })
    .from(meetingScreenshots)
    .innerJoin(meetings, eq(meetingScreenshots.meetingId, meetings.id))
    .where(and(eq(meetingScreenshots.id, parsedId.data), isNotNull(meetingScreenshots.deletedAt)))
  if (!existing) return err('Not found, or it was already restored')
  if (existing.meetingDeletedAt !== null) return err('Restore the meeting first')

  // Re-check the cap against LIVE frames — restoring grows the live count
  // exactly like a new capture does (see uploadMeetingKeyframe in
  // src/features/meetings/ai-actions.ts), so the same limit applies.
  const [liveCount] = await db
    .select({ total: count() })
    .from(liveScreenshots)
    .where(eq(liveScreenshots.meetingId, existing.meetingId))
  if ((liveCount?.total ?? 0) >= MAX_KEYFRAMES_PER_MEETING) {
    return err(`Reached the ${MAX_KEYFRAMES_PER_MEETING}-screenshot cap for this meeting`)
  }

  // Same check-then-write tradeoff as restoreSegment above.
  const restored = await db
    .update(meetingScreenshots)
    .set({ deletedAt: null, deletedBy: null })
    .where(and(eq(meetingScreenshots.id, parsedId.data), isNotNull(meetingScreenshots.deletedAt)))
    .returning({ id: meetingScreenshots.id })
  if (restored.length === 0) return err('Not found, or it was already restored')

  await logActivity({
    actorId: actor.id,
    verb: 'restored',
    entityType: 'meeting',
    entityId: existing.meetingId,
    entityLabel: keyframeDeleteLabel(existing.meetingTitle),
    pagePath: '/meetings',
  })
  revalidatePath('/meetings')
  revalidateTrashPaths()
  return ok(undefined)
}

/**
 * Restores a removed assignment. `historyId` names the still-open
 * changeKind='removed' assignment_history row (the tombstone removeAssignment
 * writes — see src/features/people/actions.ts) — assignments themselves are
 * hard-deleted by design, so there is no live-table row left to un-delete;
 * this row IS the trash record.
 */
export async function restoreAssignment(historyId: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.restore')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(historyId)
  if (!parsedId.success) return err('Invalid assignment')

  const [tombstone] = await db
    .select()
    .from(assignmentHistory)
    .where(
      and(
        eq(assignmentHistory.id, parsedId.data),
        eq(assignmentHistory.changeKind, 'removed'),
        isNull(assignmentHistory.effectiveTo),
      ),
    )
  if (!tombstone) return err('Not found, or it was already restored')

  const [liveRow] = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(and(eq(assignments.userId, tombstone.userId), eq(assignments.appId, tombstone.appId)))
  if (liveRow) return err('They are already assigned to this app')

  // The tombstone's own allocationPct is always forced to 0 (buildHistoryEntry
  // in src/features/people/allocation-history.ts) — the interval IT closed is
  // the real figure to restore. That row is `effectiveTo === tombstone's
  // effectiveFrom` for the same (userId, appId), by construction of every
  // write to this table (see closeOpenInterval/removeAssignment).
  const [predecessor] = await db
    .select({ role: assignmentHistory.role, allocationPct: assignmentHistory.allocationPct })
    .from(assignmentHistory)
    .where(
      and(
        eq(assignmentHistory.userId, tombstone.userId),
        eq(assignmentHistory.appId, tombstone.appId),
        eq(assignmentHistory.effectiveTo, tombstone.effectiveFrom),
      ),
    )
    .orderBy(desc(assignmentHistory.effectiveFrom))
    .limit(1)
  const role = predecessor?.role ?? tombstone.role
  // Defensive fallback only — a 'removed' tombstone always closes a real
  // predecessor interval by construction (see the comment above), so this
  // should never actually fire. 5 is the same floor assignInput/
  // assignmentUpdateInput enforce on allocationPct (.min(5)) in
  // src/features/people/actions.ts, so a fallback write can never violate it.
  const allocationPct = predecessor?.allocationPct ?? 5

  const at = new Date()
  let assignmentId: string | undefined
  try {
    // Mirrors assignUser's own batch in src/features/people/actions.ts:
    // insert the live row, close whichever interval is open (the 'removed'
    // tombstone the read above confirmed), append a new 'assigned' interval
    // recording the restore. All three commit together or not at all
    // (neon-http's db.batch is the one available transaction).
    const [inserted] = await db.batch([
      db
        .insert(assignments)
        .values({ userId: tombstone.userId, appId: tombstone.appId, role, allocationPct })
        .returning({ id: assignments.id }),
      db
        .update(assignmentHistory)
        .set({ effectiveTo: at })
        .where(
          and(
            eq(assignmentHistory.id, tombstone.id),
            eq(assignmentHistory.changeKind, 'removed'),
            isNull(assignmentHistory.effectiveTo),
          ),
        ),
      db.insert(assignmentHistory).values({
        userId: tombstone.userId,
        appId: tombstone.appId,
        role,
        allocationPct,
        changeKind: 'assigned',
        changedBy: actor.id,
        effectiveFrom: at,
        effectiveTo: null,
        note: null,
      }),
    ])
    assignmentId = inserted[0]?.id
  } catch (error) {
    if (isUniqueViolation(error)) return err('They are already assigned to this app')
    throw error
  }

  const appName = await appNameById(tombstone.appId)
  const slug = await slugForApp(tombstone.appId)
  const personName = await nameForUser(tombstone.userId)
  await logActivity({
    actorId: actor.id,
    verb: 'restored',
    entityType: 'assignment',
    entityId: assignmentId ?? tombstone.userId,
    entityLabel: personName ?? 'Unknown user',
    appId: tombstone.appId,
    appName,
    pagePath: `/people/${tombstone.userId}`,
    detail: `to ${appName ?? 'an app'} as ${role} at ${allocationPct}%`,
  })
  revalidateAssignmentTrashPaths(slug, tombstone.userId)
  return ok(undefined)
}

// ===========================================================================
// PURGES
//
// Race-safe order, always: (1) read whatever blob pathnames the delete is
// about to orphan, (2) the guarded hard delete — zero rows means a concurrent
// restore won the race, STOP and touch no blobs, (3) only once the row is
// truly gone, best-effort blob cleanup. Never the reverse: a live row must
// never lose its blobs to trash housekeeping. A crash between (2) and (3)
// leaks a blob, which is the accepted posture (same as elsewhere in this
// codebase — see deleteUploadedAvatar's comment in
// src/features/auth/avatar-actions.ts).
// ===========================================================================

function checkConfirm(confirm: string): ActionResult<never> | null {
  return confirm === CONFIRM_PHRASE ? null : err(`Type "${CONFIRM_PHRASE}" to confirm`)
}

/**
 * Purges a meeting. meeting_screenshots has ON DELETE CASCADE from meetings
 * (see schema.ts), so this hard delete takes every screenshot row for the
 * meeting with it — LIVE ones too, not just already-trashed ones, since a
 * purged meeting has no children left at all either way. Step 1 therefore
 * collects every one of the meeting's blob pathnames up front, not just the
 * trashed screenshots', or a live keyframe's blob would be orphaned by a
 * meeting purge with nothing left to clean it up.
 */
export async function purgeMeeting(meetingId: string, confirm: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.purge')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(meetingId)
  if (!parsedId.success) return err('Invalid meeting')
  const confirmError = checkConfirm(confirm)
  if (confirmError) return confirmError

  const blobRows = await db
    .select({ blobPathname: meetingScreenshots.blobPathname })
    .from(meetingScreenshots)
    .where(eq(meetingScreenshots.meetingId, parsedId.data))

  const deleted = await db
    .delete(meetings)
    .where(and(eq(meetings.id, parsedId.data), isNotNull(meetings.deletedAt)))
    .returning({ id: meetings.id, title: meetings.title, appId: meetings.appId })
  if (deleted.length === 0) return err('Not found, or it was restored — nothing purged')
  const [row] = deleted

  // ONE del() for the whole filmstrip, not one per frame: @vercel/blob's del()
  // takes a string[], and a meeting at the keyframe cap would otherwise pay
  // MAX_KEYFRAMES_PER_MEETING sequential round-trips inside a single server
  // action — long enough to hit the function timeout on a slow link.
  if (blobRows.length > 0) {
    try {
      await del(blobRows.map((b) => b.blobPathname))
    } catch {
      /* Already gone, or the token lost access — the rows are gone either way. */
    }
  }

  await logActivity({
    actorId: actor.id,
    verb: 'purged',
    entityType: 'meeting',
    entityId: row.id,
    entityLabel: row.title,
    appId: row.appId,
    appName: await appNameById(row.appId),
    pagePath: '/meetings',
  })
  await revalidateMeetingTrashPaths(row.appId)
  return ok(undefined)
}

export async function purgeTask(taskId: string, confirm: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.purge')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(taskId)
  if (!parsedId.success) return err('Invalid task')
  const confirmError = checkConfirm(confirm)
  if (confirmError) return confirmError

  // No blob hangs off a task — nothing to collect before the delete.
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, parsedId.data), isNotNull(tasks.deletedAt)))
    .returning({ id: tasks.id, title: tasks.title, appId: tasks.appId })
  if (deleted.length === 0) return err('Not found, or it was restored — nothing purged')
  const [row] = deleted

  await logActivity({
    actorId: actor.id,
    verb: 'purged',
    entityType: 'task',
    entityId: row.id,
    entityLabel: row.title,
    appId: row.appId,
  })
  await revalidateAppEntityTrashPaths(row.appId)
  return ok(undefined)
}

export async function purgeSprint(sprintId: string, confirm: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.purge')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(sprintId)
  if (!parsedId.success) return err('Invalid sprint')
  const confirmError = checkConfirm(confirm)
  if (confirmError) return confirmError

  // No blob hangs off a sprint. tasks.sprint_id is ON DELETE SET NULL (see
  // schema.ts), so any task still pointing at this sprint — live or trashed —
  // is released automatically by Postgres; nothing to do here for that either.
  const deleted = await db
    .delete(sprints)
    .where(and(eq(sprints.id, parsedId.data), isNotNull(sprints.deletedAt)))
    .returning({ id: sprints.id, name: sprints.name, appId: sprints.appId })
  if (deleted.length === 0) return err('Not found, or it was restored — nothing purged')
  const [row] = deleted

  const slug = await slugForApp(row.appId)
  await logActivity({
    actorId: actor.id,
    verb: 'purged',
    entityType: 'sprint',
    entityId: row.id,
    entityLabel: row.name,
    appId: row.appId,
    pagePath: slug ? '/apps/' + slug : null,
  })
  if (slug) revalidatePath('/apps/' + slug)
  revalidateTrashPaths()
  return ok(undefined)
}

export async function purgeSegment(segmentId: string, confirm: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.purge')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(segmentId)
  if (!parsedId.success) return err('Invalid note')
  const confirmError = checkConfirm(confirm)
  if (confirmError) return confirmError

  // No blob for a text note segment — the only thing worth reading ahead of
  // the delete is the parent meeting's title, so the activity row can still
  // name which meeting this was in once the segment itself is gone.
  const [existing] = await db
    .select({ meetingId: meetingNoteSegments.meetingId, meetingTitle: meetings.title })
    .from(meetingNoteSegments)
    .innerJoin(meetings, eq(meetingNoteSegments.meetingId, meetings.id))
    .where(eq(meetingNoteSegments.id, parsedId.data))
  if (!existing) return err('Not found')

  const deleted = await db
    .delete(meetingNoteSegments)
    .where(and(eq(meetingNoteSegments.id, parsedId.data), isNotNull(meetingNoteSegments.deletedAt)))
    .returning({ id: meetingNoteSegments.id })
  if (deleted.length === 0) return err('Not found, or it was restored — nothing purged')

  await logActivity({
    actorId: actor.id,
    verb: 'purged',
    entityType: 'meeting',
    entityId: existing.meetingId,
    entityLabel: noteSegmentDeleteLabel(existing.meetingTitle),
    pagePath: '/meetings',
  })
  revalidatePath('/meetings')
  revalidateTrashPaths()
  return ok(undefined)
}

export async function purgeKeyframe(screenshotId: string, confirm: string): Promise<ActionResult> {
  const actor = await requireCapability('trash.purge')
  if (!actor) return err('Admins only')
  const parsedId = uuidInput.safeParse(screenshotId)
  if (!parsedId.success) return err('Invalid screenshot')
  const confirmError = checkConfirm(confirm)
  if (confirmError) return confirmError

  const [existing] = await db
    .select({
      meetingId: meetingScreenshots.meetingId,
      meetingTitle: meetings.title,
      blobPathname: meetingScreenshots.blobPathname,
    })
    .from(meetingScreenshots)
    .innerJoin(meetings, eq(meetingScreenshots.meetingId, meetings.id))
    .where(eq(meetingScreenshots.id, parsedId.data))
  if (!existing) return err('Not found')

  const deleted = await db
    .delete(meetingScreenshots)
    .where(and(eq(meetingScreenshots.id, parsedId.data), isNotNull(meetingScreenshots.deletedAt)))
    .returning({ id: meetingScreenshots.id })
  if (deleted.length === 0) return err('Not found, or it was restored — nothing purged')

  try {
    await del(existing.blobPathname)
  } catch {
    /* Already gone, or the token lost access — the row is gone either way. */
  }

  await logActivity({
    actorId: actor.id,
    verb: 'purged',
    entityType: 'meeting',
    entityId: existing.meetingId,
    entityLabel: keyframeDeleteLabel(existing.meetingTitle),
    pagePath: '/meetings',
  })
  revalidatePath('/meetings')
  revalidateTrashPaths()
  return ok(undefined)
}
