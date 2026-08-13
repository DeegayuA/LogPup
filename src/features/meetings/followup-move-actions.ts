'use server'

import { z } from 'zod'
import { and, asc, eq, gt, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { meetingAiNotes, meetingAttendees, meetingFollowups } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { canManageMeeting } from '@/features/meetings/ai-actions'

export type MoveFollowupsResult = {
  /** How many items were pinned to a meeting. */
  moved: number
  /** People with no upcoming meeting to move their items to. */
  skipped: string[]
  /** Title of the target meeting when every moved item shares one. */
  targetTitle: string | null
}

const idsInput = z.array(z.uuid()).min(1).max(100)

/**
 * PIN open follow-ups to the NEXT meeting their person attends.
 *
 * Carried items already *drift* forward on their own (targetMeetingId null →
 * they surface at whatever meeting the person attends next — see
 * fetchCarriedFollowups in ai-actions.ts). What this adds is the deliberate
 * version of that: "we're not doing this one now, park it for the next
 * meeting" — after which the item shows on THAT meeting and on no other,
 * exactly like a follow-up someone added by hand and aimed at a meeting.
 *
 * One action serves both buttons: "move one" is a one-element array. Each
 * item resolves to ITS OWN person's next meeting — a "move all" over four
 * items from two people can legitimately land on two different meetings, and
 * collapsing that to one meeting would pin someone's question to a meeting
 * they will not be in.
 *
 * Who may move an item: an admin, the person the item belongs to, or whoever
 * created its source meeting — the same three parties the panel lets act on
 * a row. Items that are not open, or whose person has nothing scheduled, are
 * reported back by name rather than silently left behind.
 */
export async function moveFollowupsToNextMeeting(
  followupIds: unknown,
): Promise<ActionResult<MoveFollowupsResult>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')

  const parsed = idsInput.safeParse(followupIds)
  if (!parsed.success) return err('Nothing to move')

  const rows = await db
    .select({
      id: meetingFollowups.id,
      userId: meetingFollowups.userId,
      personName: meetingFollowups.personName,
      text: meetingFollowups.text,
      status: meetingFollowups.status,
      sourceCreatedBy: liveMeetings.createdBy,
      sourceAppId: liveMeetings.appId,
    })
    .from(meetingFollowups)
    // meetingFollowups has no deletedAt of its own — live iff its source
    // meeting is live (see MEETING_CHILD_TABLES in src/db/live.ts). The inner
    // join is what makes a trashed meeting's items unreadable here, so nobody
    // can pin an item from a binned meeting onto a real upcoming one.
    .innerJoin(liveMeetings, eq(liveMeetings.id, meetingFollowups.sourceMeetingId))
    .where(inArray(meetingFollowups.id, parsed.data))

  const isAdmin = session.user.role === 'admin'
  const movable = rows.filter(
    (row) =>
      row.status === 'open' &&
      row.userId !== null &&
      (isAdmin || row.userId === session.user.id || row.sourceCreatedBy === session.user.id),
  )
  if (movable.length === 0) return err('Nothing here can be moved')

  // ONE query for every person's upcoming meetings, earliest picked per
  // person in memory — not a query per item. Ordered ascending so the first
  // row seen for a user IS their next meeting.
  const userIds = [...new Set(movable.map((row) => row.userId as string))]
  const upcoming = await db
    .select({
      userId: meetingAttendees.userId,
      meetingId: liveMeetings.id,
      title: liveMeetings.title,
      startsAt: liveMeetings.startsAt,
    })
    .from(meetingAttendees)
    // meetingAttendees has no deletedAt of its own — live iff its meeting is
    // live (see MEETING_CHILD_TABLES in src/db/live.ts). Without the join a
    // trashed meeting could still win as somebody's next meeting, and the
    // move would park their item somewhere it will never be raised.
    .innerJoin(liveMeetings, eq(liveMeetings.id, meetingAttendees.meetingId))
    .where(and(inArray(meetingAttendees.userId, userIds), gt(liveMeetings.startsAt, new Date())))
    .orderBy(asc(liveMeetings.startsAt))

  const nextByUser = new Map<string, { meetingId: string; title: string }>()
  for (const row of upcoming) {
    if (!nextByUser.has(row.userId)) {
      nextByUser.set(row.userId, { meetingId: row.meetingId, title: row.title })
    }
  }

  const moved: typeof movable = []
  const skippedNames = new Set<string>()
  for (const item of movable) {
    const target = nextByUser.get(item.userId as string)
    if (!target) {
      skippedNames.add(item.personName)
      continue
    }
    await db
      .update(meetingFollowups)
      .set({ targetMeetingId: target.meetingId })
      .where(eq(meetingFollowups.id, item.id))
    moved.push(item)
    await logActivity({
      actorId: session.user.id,
      verb: 'moved',
      entityType: 'followup',
      entityId: item.id,
      entityLabel: item.text.slice(0, 120),
      appId: item.sourceAppId,
      pagePath: '/meetings',
      detail: `to "${target.title}"`,
      metadata: { targetMeetingId: target.meetingId, personName: item.personName },
    })
  }

  if (moved.length === 0) {
    return err(
      `No upcoming meeting to move to — schedule one with ${[...skippedNames].join(', ')} first`,
    )
  }

  revalidatePath('/meetings')

  // Name the destination when it is ONE destination; a mixed move says so
  // through the count and the per-person skips instead of lying with a title.
  const targets = new Set(moved.map((item) => nextByUser.get(item.userId as string)?.meetingId))
  const targetTitle =
    targets.size === 1 ? (nextByUser.get(moved[0].userId as string)?.title ?? null) : null

  return ok({ moved: moved.length, skipped: [...skippedNames], targetTitle })
}

/**
 * ADMIN-ONLY: remove a follow-up outright — it stops carrying forward because
 * it stops existing. Deliberately not "resolve": resolving writes history
 * saying the item was addressed; this is for items that should never have
 * been tracked (mis-parsed, duplicate, noise). The deletion itself is logged,
 * so even a removal leaves a trace in the activity trail.
 *
 * Admin-only per the workspace rule that destroying things is an admin's
 * call — same as tasks, sprints, meetings and assignments.
 */
export async function deleteFollowup(followupId: unknown): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (session.user.role !== 'admin') return err('Only an admin can remove a follow-up')

  const parsed = z.uuid().safeParse(followupId)
  if (!parsed.success) return err('Follow-up not found')

  const [existing] = await db
    .select({
      id: meetingFollowups.id,
      text: meetingFollowups.text,
      personName: meetingFollowups.personName,
      sourceAppId: liveMeetings.appId,
    })
    .from(meetingFollowups)
    // A follow-up is live iff its source meeting is (see MEETING_CHILD_TABLES
    // in src/db/live.ts), so trashing the meeting has to make this read miss:
    // the item then reports "not found" instead of being removable — and
    // logged as removed — from a meeting that is already in the bin.
    .innerJoin(liveMeetings, eq(liveMeetings.id, meetingFollowups.sourceMeetingId))
    .where(eq(meetingFollowups.id, parsed.data))
  if (!existing) return err('Follow-up not found')

  await db.delete(meetingFollowups).where(eq(meetingFollowups.id, parsed.data))

  await logActivity({
    actorId: session.user.id,
    verb: 'deleted',
    entityType: 'followup',
    entityId: existing.id,
    entityLabel: existing.text.slice(0, 120),
    appId: existing.sourceAppId,
    pagePath: '/meetings',
    detail: `for ${existing.personName}`,
  })

  revalidatePath('/meetings')
  return ok(undefined)
}

const editTextInput = z.object({
  followupId: z.uuid(),
  text: z.string().trim().min(2).max(500),
})

/**
 * ADMIN-ONLY: rewrite what a follow-up says. The AI transcribes what it heard
 * and sometimes hears wrong; the person it belongs to can already answer or
 * resolve it, but only an admin may change the record of what was asked.
 * The before/after lands in the activity metadata, so an edit is never a
 * silent rewrite of history.
 */
export async function editFollowupText(input: unknown): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')
  if (session.user.role !== 'admin') return err('Only an admin can edit a follow-up')

  const parsed = editTextInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [existing] = await db
    .select({
      id: meetingFollowups.id,
      text: meetingFollowups.text,
      personName: meetingFollowups.personName,
      sourceAppId: liveMeetings.appId,
    })
    .from(meetingFollowups)
    // Same liveness rule as the delete above: a follow-up whose meeting is in
    // the bin must stop being readable, so an edit cannot rewrite the record
    // of a question asked at a meeting nobody can open any more.
    .innerJoin(liveMeetings, eq(liveMeetings.id, meetingFollowups.sourceMeetingId))
    .where(eq(meetingFollowups.id, parsed.data.followupId))
  if (!existing) return err('Follow-up not found')

  await db
    .update(meetingFollowups)
    .set({ text: parsed.data.text })
    .where(eq(meetingFollowups.id, parsed.data.followupId))

  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'followup',
    entityId: existing.id,
    entityLabel: parsed.data.text.slice(0, 120),
    appId: existing.sourceAppId,
    pagePath: '/meetings',
    detail: `for ${existing.personName}`,
    metadata: { text: { from: existing.text, to: parsed.data.text } },
  })

  revalidatePath('/meetings')
  return ok(undefined)
}

const summaryInput = z.object({
  meetingId: z.uuid(),
  // Same ceiling as the notes column's own limit elsewhere in this feature.
  summary: z.string().trim().max(20000),
})

/**
 * REWRITE THE MEETING WRITE-UP BY HAND.
 *
 * The summary was previously read-only: regenerate it or live with it. A
 * write-up is a record people circulate, and the model gets names, numbers
 * and decisions subtly wrong often enough that "fix that one line" has to be
 * possible without discarding the whole pass.
 *
 * TAKES THE RAW STORED TEXT, deliberately — not the language slice on screen.
 * A bilingual write-up keeps English and Sinhala in ONE column
 * (splitBilingualSummary reads them apart at render time), so accepting the
 * English view back would write it over the top of both and silently destroy
 * the Sinhala half. The editor shows the raw text and says so.
 *
 * Empty string is allowed and means "no write-up" — the panel then renders
 * the same nothing-yet state as before the AI ran, rather than an empty box
 * pretending to be a summary.
 *
 * Permission is `canManageMeeting` (organiser or admin), matching every other
 * write on this surface. The previous text goes into the activity metadata:
 * an edited record that leaves no trace of what it said before is exactly the
 * thing minutes are supposed to prevent.
 */
export async function updateMeetingSummary(input: unknown): Promise<ActionResult> {
  const parsed = summaryInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const ctx = await canManageMeeting(parsed.data.meetingId)
  if (!ctx) return err('Only the organiser or an admin can edit the write-up')

  const [existing] = await db
    .select({ summary: meetingAiNotes.summary })
    .from(meetingAiNotes)
    // meetingAiNotes has no deletedAt of its own — live iff its meeting is
    // (see MEETING_CHILD_TABLES in src/db/live.ts). canManageMeeting above
    // already resolves through liveMeetings and refuses a trashed meeting;
    // naming the liveness source in the statement too means this read stays
    // correct on its own terms if that gate ever changes.
    .innerJoin(liveMeetings, eq(liveMeetings.id, meetingAiNotes.meetingId))
    .where(eq(meetingAiNotes.meetingId, parsed.data.meetingId))
  if (!existing) return err('There is no write-up to edit yet')

  const next = parsed.data.summary || null
  if (next === existing.summary) return ok(undefined)

  await db
    .update(meetingAiNotes)
    .set({ summary: next })
    .where(eq(meetingAiNotes.meetingId, parsed.data.meetingId))

  await logActivity({
    actorId: ctx.session.user.id,
    verb: 'updated',
    entityType: 'meeting',
    entityId: parsed.data.meetingId,
    entityLabel: ctx.meeting.title,
    appId: ctx.meeting.appId,
    pagePath: '/meetings',
    detail: next ? 'edited the write-up' : 'cleared the write-up',
    // The previous text, not a diff: a diff needs the old text to be useful
    // anyway, and this is the only copy that survives the overwrite.
    metadata: { previousSummary: existing.summary },
  })

  revalidatePath('/meetings')
  return ok(undefined)
}
