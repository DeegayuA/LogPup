'use server'

import { z } from 'zod'
import { and, asc, eq, gt, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { meetingAttendees, meetingFollowups, meetings } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'

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
      sourceCreatedBy: meetings.createdBy,
      sourceAppId: meetings.appId,
    })
    .from(meetingFollowups)
    .innerJoin(meetings, eq(meetings.id, meetingFollowups.sourceMeetingId))
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
      meetingId: meetings.id,
      title: meetings.title,
      startsAt: meetings.startsAt,
    })
    .from(meetingAttendees)
    .innerJoin(meetings, eq(meetings.id, meetingAttendees.meetingId))
    .where(and(inArray(meetingAttendees.userId, userIds), gt(meetings.startsAt, new Date())))
    .orderBy(asc(meetings.startsAt))

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
      sourceAppId: meetings.appId,
    })
    .from(meetingFollowups)
    .innerJoin(meetings, eq(meetings.id, meetingFollowups.sourceMeetingId))
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
      sourceAppId: meetings.appId,
    })
    .from(meetingFollowups)
    .innerJoin(meetings, eq(meetings.id, meetingFollowups.sourceMeetingId))
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
