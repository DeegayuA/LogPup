'use server'

/**
 * The lifecycle of a TAKE: opened when somebody presses record, closed when
 * they stop, and removable afterwards along with everything it transcribed.
 *
 * A separate file from ai-actions.ts on purpose. That file is four thousand
 * lines and is edited by more than one session at a time; a take's lifecycle
 * is a small, self-contained thing, and putting it here means it can be read
 * in one screen and changed without touching the recording pipeline it hangs
 * off.
 *
 * PERMISSION IS canManageMeeting THROUGHOUT — the same gate transcribeSegment
 * already uses. Deleting a recording destroys the studio's account of part of
 * a conversation, so it must not be reachable by anyone who could not have
 * made that recording in the first place.
 */

import { revalidatePath } from 'next/cache'
import { and, eq, isNull, max } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { meetingRecordingSegments, meetingRecordings } from '@/db/schema'
import { logActivity } from '@/features/activity/log'
import { canManageMeeting } from '@/features/meetings/ai-actions'
import { listMeetingRecordings, type MeetingRecordings } from '@/features/meetings/recording-queries'
import { ok, err, type ActionResult } from '@/lib/action-result'

const idInput = z.uuid()

/**
 * Opens a take and hands back the number it will be called.
 *
 * THE NUMBER COMES FROM max(take_index) + 1 ACROSS DELETED ROWS TOO. A deleted
 * take keeps its slot, so take 3 stays take 3 forever even after it is removed
 * — otherwise a restore could collide with a take recorded later, and worse,
 * "we lost take 3" would stop meaning anything the moment the numbers shifted
 * underneath the person who said it. The unique index on (meeting_id,
 * take_index) is what makes that guarantee enforceable rather than hoped for;
 * two tabs racing to open a take will have one of them lose the insert, which
 * is the correct outcome and is reported rather than swallowed.
 */
export async function openRecordingTake(
  meetingId: string,
): Promise<ActionResult<{ id: string; takeIndex: number }>> {
  const parsed = idInput.safeParse(meetingId)
  if (!parsed.success) return err('Bad meeting id')

  const ctx = await canManageMeeting(parsed.data)
  if (!ctx) return err('Only admins or the meeting creator can record')

  const [highest] = await db
    .select({ takeIndex: max(meetingRecordings.takeIndex) })
    .from(meetingRecordings)
    .where(eq(meetingRecordings.meetingId, parsed.data))

  const takeIndex = (highest?.takeIndex ?? 0) + 1
  try {
    const [row] = await db
      .insert(meetingRecordings)
      .values({
        meetingId: parsed.data,
        takeIndex,
        createdBy: ctx.session.user.id,
      })
      .returning({ id: meetingRecordings.id, takeIndex: meetingRecordings.takeIndex })
    return ok(row)
  } catch {
    // Almost certainly the unique index doing its job against a second tab.
    // Said plainly rather than retried: two tabs recording one meeting is a
    // situation the person needs to know about, not one to paper over.
    return err('Another tab just started a take for this meeting — reload before recording')
  }
}

/**
 * Closes a take. Idempotent, and deliberately never re-stamps an ended_at that
 * is already set: a second stop (a tab closing after the user already pressed
 * stop) must not move the recording's end time later than the moment it
 * actually ended.
 */
export async function closeRecordingTake(recordingId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(recordingId)
  if (!parsed.success) return err('Bad recording id')

  const [row] = await db
    .select({ meetingId: meetingRecordings.meetingId, endedAt: meetingRecordings.endedAt })
    .from(meetingRecordings)
    .where(eq(meetingRecordings.id, parsed.data))
  if (!row) return err('That recording no longer exists')
  if (row.endedAt !== null) return ok(undefined)

  const ctx = await canManageMeeting(row.meetingId)
  if (!ctx) return err('Only admins or the meeting creator can record')

  await db
    .update(meetingRecordings)
    .set({ endedAt: new Date() })
    .where(and(eq(meetingRecordings.id, parsed.data), isNull(meetingRecordings.endedAt)))
  revalidatePath(`/meetings/${row.meetingId}`)
  return ok(undefined)
}

/**
 * Removes a take and everything it transcribed.
 *
 * SOFT, per the repo rule, and in one statement per table so a half-deleted
 * take cannot exist: the recording is hidden and its segments are hidden, or
 * neither is. The transcript ROWS survive — that is what makes restore real
 * rather than a button that apologises.
 *
 * What this deliberately does NOT do is rewrite the meeting's summary. A
 * synthesis that quoted a now-deleted take is stale, and staleness is DERIVED
 * (see recording-queries.ts) rather than stamped here: a column would be one
 * more thing to keep true, and the derivation cannot drift because it compares
 * the two timestamps that already exist.
 */
export async function deleteRecordingTake(recordingId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(recordingId)
  if (!parsed.success) return err('Bad recording id')

  const [row] = await db
    .select({
      meetingId: meetingRecordings.meetingId,
      takeIndex: meetingRecordings.takeIndex,
      deletedAt: meetingRecordings.deletedAt,
    })
    .from(meetingRecordings)
    .where(eq(meetingRecordings.id, parsed.data))
  if (!row) return err('That recording no longer exists')
  if (row.deletedAt !== null) return ok(undefined)

  const ctx = await canManageMeeting(row.meetingId)
  if (!ctx) return err('Only admins or the meeting creator can remove a recording')

  const at = new Date()
  const by = ctx.session.user.id
  await db
    .update(meetingRecordings)
    .set({ deletedAt: at, deletedBy: by })
    .where(eq(meetingRecordings.id, parsed.data))
  await db
    .update(meetingRecordingSegments)
    .set({ deletedAt: at, deletedBy: by })
    .where(
      and(
        eq(meetingRecordingSegments.recordingId, parsed.data),
        isNull(meetingRecordingSegments.deletedAt),
      ),
    )

  await logActivity({
    actorId: by,
    verb: 'deleted',
    entityType: 'meeting',
    entityId: row.meetingId,
    entityLabel: ctx.meeting.title,
    pagePath: `/meetings/${row.meetingId}`,
    detail: `recording take ${row.takeIndex} and its transcript`,
  })

  revalidatePath(`/meetings/${row.meetingId}`)
  return ok(undefined)
}

/**
 * Puts a take back, with the segments that went down with it.
 *
 * Only the segments this delete took: `deleted_at` is matched to the
 * recording's own timestamp, so a segment removed separately, earlier, stays
 * removed. Restoring a take must not quietly resurrect something somebody
 * deleted for a different reason.
 */
export async function restoreRecordingTake(recordingId: string): Promise<ActionResult> {
  const parsed = idInput.safeParse(recordingId)
  if (!parsed.success) return err('Bad recording id')

  const [row] = await db
    .select({
      meetingId: meetingRecordings.meetingId,
      takeIndex: meetingRecordings.takeIndex,
      deletedAt: meetingRecordings.deletedAt,
    })
    .from(meetingRecordings)
    .where(eq(meetingRecordings.id, parsed.data))
  if (!row) return err('That recording no longer exists')
  if (row.deletedAt === null) return ok(undefined)

  const ctx = await canManageMeeting(row.meetingId)
  if (!ctx) return err('Only admins or the meeting creator can restore a recording')

  await db
    .update(meetingRecordingSegments)
    .set({ deletedAt: null, deletedBy: null })
    .where(
      and(
        eq(meetingRecordingSegments.recordingId, parsed.data),
        eq(meetingRecordingSegments.deletedAt, row.deletedAt),
      ),
    )
  await db
    .update(meetingRecordings)
    .set({ deletedAt: null, deletedBy: null })
    .where(eq(meetingRecordings.id, parsed.data))

  await logActivity({
    actorId: ctx.session.user.id,
    verb: 'restored',
    entityType: 'meeting',
    entityId: row.meetingId,
    entityLabel: ctx.meeting.title,
    pagePath: `/meetings/${row.meetingId}`,
    detail: `recording take ${row.takeIndex}`,
  })

  revalidatePath(`/meetings/${row.meetingId}`)
  return ok(undefined)
}


/**
 * The take list, as a server action so the recording panel can refetch it.
 *
 * A thin wrapper over the query rather than a second implementation: the
 * permission gate, the live/removed split and the derived staleness all stay
 * in one place, and this exists only because the panel is a client component
 * and cannot call a query directly.
 */
export async function getMeetingRecordings(
  meetingId: string,
): Promise<ActionResult<MeetingRecordings>> {
  const parsed = idInput.safeParse(meetingId)
  if (!parsed.success) return err('Bad meeting id')
  const rows = await listMeetingRecordings(parsed.data)
  if (!rows) return err('You cannot read this meeting')
  return ok(rows)
}
