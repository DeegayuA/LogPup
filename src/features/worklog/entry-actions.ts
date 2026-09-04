'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { worklogEntries } from '@/db/schema'
import { liveTasks, liveWorklogEntries } from '@/db/live'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { WORK_DAY_PATTERN, isFutureWorkDay } from '@/features/worklog/worklog-day'
import { syncAutoScore } from '@/features/worklog/auto-score-sync'
import {
  ENTRY_CATEGORIES,
  ENTRY_MINUTES_MAX,
  ENTRY_MINUTES_MIN,
  ENTRY_NOTE_MAX,
  ENTRY_SOURCES,
  validateEntry,
} from '@/features/worklog/entries'

/**
 * Writing one person's own time entries.
 *
 * SELF ONLY, AND NOT BY OVERSIGHT. There is deliberately no `targetUserId`
 * parameter anywhere in this file and no `worklog.write.any` capability for
 * any of the seven seats — capabilities.test.ts asserts that key does not
 * exist. A worklog is a FIRST-PERSON STATEMENT about somebody's own day that a
 * manager then reads back, so an admin writing one "on behalf of" a person
 * would be putting words in their mouth in the one record that is supposed to
 * be theirs. Every write below is scoped by `and(eq(id), eq(userId, own))`,
 * which is what makes a guessed row id useless rather than merely unlikely.
 *
 * The shared rules live in `entries.ts` and are applied here rather than
 * restated: zod covers the per-field shapes and `validateEntry` covers the
 * cross-field category/task rule, so the action and any UI that pre-validates
 * cannot drift into two different answers.
 */

function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[worklog-entries] ${context}`, error)
  return err('Something went wrong — try again')
}

/**
 * The actor, if they may write their own worklog at all.
 *
 * `worklog.write.own` is 'own' for every seat that holds it and 'none' for
 * stakeholder and auditor, so the resource is the actor themselves.
 */
async function writer() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'worklog.write.own', { ownerId: actor.id })) return null
  return actor
}

// The mutable body of an entry. Shared by create and update so the two cannot
// diverge on what a valid entry is.
const entryFields = {
  minutes: z
    .number()
    .int('Enter the time in whole minutes')
    .min(ENTRY_MINUTES_MIN, 'That entry has no time on it')
    .max(ENTRY_MINUTES_MAX, 'A single entry cannot be longer than a day'),
  category: z.enum(ENTRY_CATEGORIES),
  // Nullable AND optional: the UI sends null to clear it, and omits it
  // entirely for the non-task categories that must not carry one.
  taskId: z.string().uuid('That is not a task').nullable().optional(),
  // Which project the time belongs to. For a task entry the server DERIVES
  // this from the task rather than trusting the client, so a stale or forged
  // appId cannot attribute somebody's hours to a project the task is not on.
  // For non-task entries it is the caller's answer, and null is legitimate.
  appId: z.string().uuid('That is not a project').nullable().optional(),
  billable: z.boolean().optional(),
  note: z.string().trim().max(ENTRY_NOTE_MAX, 'That note is too long').nullable().optional(),
}

const createInput = z.object({
  // Taken from the client so somebody can still fill in yesterday — backfill
  // is the normal case after leave — but never trusted as free-form text: it
  // reaches a `date` column.
  day: z.string().regex(WORK_DAY_PATTERN, 'That is not a day'),
  ...entryFields,
  // An AI draft marks its proposed rows so we can later measure how often one
  // is accepted unedited. It defaults to 'manual' because a row that arrived
  // without saying otherwise was typed by a person.
  source: z.enum(ENTRY_SOURCES).optional(),
})

/**
 * Resolve which project an entry belongs to.
 *
 * For a TASK entry the project is read from the task itself — the client's
 * appId is ignored entirely. A caller could otherwise attribute their hours
 * to a project the task does not belong to, which would land in that
 * project's cost with nothing to contradict it.
 *
 * For every other category the caller's answer stands, including null:
 * admin and learning time frequently belongs to no project, and forcing a
 * choice would make people name a wrong one.
 */
async function resolveEntryAppId(
  category: string,
  taskId: string | null,
  appId: string | null,
): Promise<{ ok: true; appId: string | null } | { ok: false; message: string }> {
  if (category !== 'task') return { ok: true, appId }
  if (!taskId) return { ok: false, message: 'Pick the task that time went to' }

  // liveTasks, not the raw table: a TRASHED task must not accept hours. Read
  // raw and a soft-deleted task comes back as live, so time gets attributed to
  // work somebody deliberately removed — and the entry then carries that task's
  // app id, quietly filing the hours under a project the task no longer belongs
  // to. The "no longer exists" message below is already the right sentence for
  // it; it just was not reachable.
  const [task] = await db
    .select({ appId: liveTasks.appId })
    .from(liveTasks)
    .where(eq(liveTasks.id, taskId))
    .limit(1)

  if (!task) return { ok: false, message: 'That task no longer exists' }
  return { ok: true, appId: task.appId }
}

export async function createWorklogEntry(
  raw: z.input<typeof createInput>,
): Promise<ActionResult<{ id: string }>> {
  const actor = await writer()
  if (!actor) return err('Not allowed')

  const parsed = createInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const input = parsed.data

  // A work log records what happened, and today's entries stay editable all
  // day, so there is never a reason to write a future one.
  if (isFutureWorkDay(input.day, new Date())) return err('That day has not happened yet')

  // The cross-field rule, from the shared module rather than restated here.
  //
  // `requireAppForTask: false` because the project is NOT KNOWN YET. A task
  // entry deliberately arrives with appId null — entry-form.ts says so, and
  // resolveEntryAppId below derives it from the task. Checking the rule here,
  // against the pre-resolution input, refused every task entry in the product
  // with "That task is not linked to a project" and never reached the code
  // that would have supplied one. The rule is not skipped, it is MOVED to
  // below the resolution, where the fact it asks about actually exists.
  const valid = validateEntry(input, { requireAppForTask: false })
  if (!valid.ok) return err(valid.message)

  const note = input.note?.trim() ? input.note.trim() : null

  // Attribution is resolved SERVER-SIDE for task entries: the project comes
  // from the task, never from the client. Storing it (rather than joining at
  // read time) is what keeps the hours attributed after the task is deleted —
  // taskId is ON DELETE SET NULL, appId is not derived from it again.
  const resolvedAppId = await resolveEntryAppId(input.category, input.taskId ?? null, input.appId ?? null)
  if (!resolvedAppId.ok) return err(resolvedAppId.message)

  // The rule validateEntry was asked to skip, now that the answer is known.
  // Same sentence it would have said, at the point where it is true.
  if (input.category === 'task' && resolvedAppId.appId === null) {
    return err('That task is not linked to a project')
  }

  try {
    const [row] = await db
      .insert(worklogEntries)
      .values({
        userId: actor.id,
        day: input.day,
        minutes: input.minutes,
        // Normalised to null rather than passed through: validateEntry has
        // already refused a task on a non-task category, so this only ever
        // collapses '' and undefined to the column's real empty value.
        taskId: input.category === 'task' ? (input.taskId ?? null) : null,
        appId: resolvedAppId.appId,
        category: input.category,
        billable: input.billable ?? false,
        note,
        source: input.source ?? 'manual',
      })
      .returning({ id: worklogEntries.id })

    // entityId is the AUTHOR's user id, not the row's — the convention
    // daily_worklogs established, because what a reader of the feed wants to
    // click through to is that person's log rather than one entry in
    // isolation. THE NOTE NEVER GOES IN THE METADATA: the activity feed is
    // read by the whole team and the note is what somebody wrote about their
    // own day. Name the day, not its contents.
    await logActivity({
      actorId: actor.id,
      verb: 'created',
      entityType: 'worklog',
      entityId: actor.id,
      entityLabel: `Time entry for ${input.day}`,
      pagePath: '/worklog',
      metadata: {
        day: input.day,
        minutes: input.minutes,
        category: input.category,
        source: input.source ?? 'manual',
      },
    })

    /* THE DAY'S SCORE FOLLOWS ITS HOURS. Awaited rather than fired and
       forgotten, so the revalidate below re-renders a page that already
       reflects the new score — otherwise the entry appears and the day still
       reads "hours in, no score" until the next navigation. It never throws and
       it never overwrites a score the person typed; see auto-score-sync.ts. */
    await syncAutoScore(actor.id, input.day)

    revalidatePath('/worklog')
    return ok({ id: row.id })
  } catch (error) {
    return unexpected('createWorklogEntry', error)
  }
}

const updateInput = z.object({
  id: z.string().uuid(),
  ...entryFields,
})

/**
 * Corrects an entry in place.
 *
 * TAKES THE WHOLE MUTABLE BODY, not a patch. A partial update could set
 * `category` to 'meeting' while leaving a stale `taskId` behind, which is
 * precisely the state the category/task rule exists to prevent — and a rule
 * that only holds on create is not a rule.
 *
 * DOES NOT MOVE AN ENTRY BETWEEN DAYS. `day` is absent on purpose: the day is
 * the entry's identity in the editor, and a silent move would change two days'
 * totals at once while only one of them was on screen. Moving time to another
 * day is a delete and a create, both of which the person can see.
 */
export async function updateWorklogEntry(
  raw: z.input<typeof updateInput>,
): Promise<ActionResult<void>> {
  const actor = await writer()
  if (!actor) return err('Not allowed')

  const parsed = updateInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const input = parsed.data

  // Same reason as create: the project is not known until the task is read.
  const valid = validateEntry(input, { requireAppForTask: false })
  if (!valid.ok) return err(valid.message)

  const note = input.note?.trim() ? input.note.trim() : null

  // Same server-side resolution as create: a task entry's project comes from
  // the task, never the client. An edit that switches category from 'meeting'
  // to 'task' must RE-derive it rather than keep the meeting's project.
  const resolvedAppId = await resolveEntryAppId(input.category, input.taskId ?? null, input.appId ?? null)
  if (!resolvedAppId.ok) return err(resolvedAppId.message)

  if (input.category === 'task' && resolvedAppId.appId === null) {
    return err('That task is not linked to a project')
  }

  try {
    // Through the LIVE subquery: a soft-deleted entry must read as gone, or
    // "edit" would quietly resurrect a row the person had already removed.
    const [existing] = await db
      // `day` comes back too: the update never changes which day an entry is
      // on, but the derived score for that day has to be recomputed afterwards
      // and the client does not send the day on an edit.
      .select({ id: liveWorklogEntries.id, day: liveWorklogEntries.day })
      .from(liveWorklogEntries)
      .where(and(
        eq(liveWorklogEntries.id, input.id),
        eq(liveWorklogEntries.userId, actor.id),
      ))
    if (!existing) return err('That entry no longer exists')

    await db
      .update(worklogEntries)
      .set({
        minutes: input.minutes,
        taskId: input.category === 'task' ? (input.taskId ?? null) : null,
        appId: resolvedAppId.appId,
        category: input.category,
        billable: input.billable ?? false,
        note,
        updatedAt: new Date(),
      })
      // The ownership predicate is repeated on the WRITE rather than trusted
      // from the read above: the read proves the row was theirs a moment ago,
      // and only this scoping makes the update itself incapable of touching
      // anybody else's row.
      .where(and(eq(worklogEntries.id, input.id), eq(worklogEntries.userId, actor.id)))

    // Editing an entry's minutes changes the day's total, so the derived score
    // has to move with it — see the same call in createWorklogEntry.
    await syncAutoScore(actor.id, existing.day)

    revalidatePath('/worklog')
    return ok(undefined)
  } catch (error) {
    return unexpected('updateWorklogEntry', error)
  }
}

const deleteInput = z.object({ id: z.string().uuid() })

/**
 * Removes an entry — SOFT, per the repo rule: nothing here is ever hard
 * deleted, so a mis-tap is recoverable and the row stays auditable.
 *
 * There is no `deletedBy` column to fill: writes are self-only, so the
 * deleter is always the row's own `userId`, and a second column holding a
 * copy of that could only ever disagree with it.
 */
export async function deleteWorklogEntry(
  raw: z.input<typeof deleteInput>,
): Promise<ActionResult<void>> {
  const actor = await writer()
  if (!actor) return err('Not allowed')

  const parsed = deleteInput.safeParse(raw)
  if (!parsed.success) return err('That is not an entry')

  try {
    const [existing] = await db
      .select({
        id: liveWorklogEntries.id,
        day: liveWorklogEntries.day,
        minutes: liveWorklogEntries.minutes,
        category: liveWorklogEntries.category,
      })
      .from(liveWorklogEntries)
      .where(and(
        eq(liveWorklogEntries.id, parsed.data.id),
        eq(liveWorklogEntries.userId, actor.id),
      ))
    // Already gone reads as gone rather than as an error: deleting twice is
    // a double-tap, not a failure the person needs to be told about.
    if (!existing) return ok(undefined)

    await db
      .update(worklogEntries)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(worklogEntries.id, parsed.data.id), eq(worklogEntries.userId, actor.id)))

    await logActivity({
      actorId: actor.id,
      verb: 'deleted',
      entityType: 'worklog',
      entityId: actor.id,
      entityLabel: `Time entry for ${existing.day}`,
      pagePath: '/worklog',
      metadata: { day: existing.day, minutes: existing.minutes, category: existing.category },
    })

    // Removing hours lowers the day's total, so the derived score comes down
    // with it. Removing the LAST entry leaves the previous derived score
    // standing rather than deleting the row — see auto-score-sync.ts for why.
    await syncAutoScore(actor.id, existing.day)

    revalidatePath('/worklog')
    return ok(undefined)
  } catch (error) {
    return unexpected('deleteWorklogEntry', error)
  }
}
