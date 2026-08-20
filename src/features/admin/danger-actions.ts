'use server'

// The /admin/danger controls beyond "Clear database".
//
// NOT ONE HARD DELETE LIVES IN THIS FILE, and that is structural rather than
// stylistic: src/db/live.test.ts check 4 confines every hard delete to
// src/features/admin/trash-actions.ts, so every permanent removal here is a
// TWO-PHASE move — mark the rows deleted (an ordinary db.update, which the
// guard does not restrict), then hand each id to the matching purge* action in
// trash-actions.ts, which performs the guarded hard delete and the Vercel Blob
// cleanup at the one allowlisted site.
//
// The failure mode of that split is deliberately the safe one. If a run dies
// between the two phases, the rows are sitting in Trash — visible, restorable,
// and purgeable by running the same control again. The reverse split (delete
// first, mark later) has no such halfway house.
//
// Every purge* call passes PURGE_CONFIRM_PHRASE, imported rather than spelled
// out, for the reason trash-actions.ts's own CONFIRM_PHRASE comment gives: two
// literals that agree today drift apart silently.

import { z } from 'zod'
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { liveApps, liveMeetings, liveScreenshots, liveSprints, liveTasks } from '@/db/live'
import { meetingScreenshots, sprints, tasks } from '@/db/schema'
import { requireCapability } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { buildSnapshot, encryptSnapshot } from '@/features/admin/backup'
import { getTrash } from '@/features/admin/trash-queries'
import {
  purgeApp,
  purgeBug,
  purgeKeyframe,
  purgeMeeting,
  purgeSegment,
  purgeSprint,
  purgeTask,
} from '@/features/admin/trash-actions'
import { PURGE_CONFIRM_PHRASE } from '@/features/admin/components/trash-card-logic'
import { deleteMeeting } from '@/features/meetings/actions'
import type { TrashKind } from '@/features/admin/trash-grouping'
import {
  DANGER_BATCH_LIMIT,
  backupFilename,
  backupTooLarge,
  deleteMeetingPhrase,
  emptyTrashPhrase,
  matchesConfirm,
  planBatch,
  purgeQueue,
  purgeableTrashTotal,
  resetAppPhrase,
  wipeRecordingsPhrase,
  type PurgeProgress,
} from '@/features/admin/danger-logic'

const uuidInput = z.uuid()

const REFUSED = 'Admins only'

function revalidateDangerPaths() {
  revalidatePath('/admin/danger')
  revalidatePath('/admin')
  revalidatePath('/')
}

/**
 * Runs one batch of purges and counts what happened.
 *
 * A purge that returns "not found" is SKIPPED, not failed: by the time the
 * queue reaches a keyframe its meeting may already have been purged three
 * entries earlier and taken it along by cascade, which is the ordering
 * PURGEABLE_TRASH_KINDS exists to produce. Only a refusal aborts — if the
 * actor turns out not to hold trash.purge, every remaining call would refuse
 * identically and reporting "0 purged" would read as "there was nothing to do".
 */
async function runPurgeBatch(
  jobs: readonly { run: () => Promise<ActionResult> }[],
  remaining: number,
): Promise<ActionResult<PurgeProgress>> {
  let purged = 0
  let skipped = 0
  for (const job of jobs) {
    const res = await job.run()
    if (res.ok) {
      purged += 1
      continue
    }
    if (res.error === REFUSED) {
      return err('This needs the permanent-delete permission (trash.purge) as well')
    }
    skipped += 1
  }
  return ok({ purged, skipped, remaining })
}

// ===========================================================================
// 1. Export workspace backup — the only control here that destroys nothing
// ===========================================================================

export type BackupDownload = {
  filename: string
  /** AES-256-GCM ciphertext, base64 — see encryptSnapshot in backup.ts. */
  base64: string
  byteSize: number
}

/**
 * A full encrypted snapshot, handed back for the browser to save.
 *
 * buildSnapshot/encryptSnapshot are reused wholesale rather than re-serialised
 * here: backup.ts's explicit column list is what keeps password hashes and
 * Google refresh tokens out of the file, and a second serialiser would be a
 * second place for that decision to be got wrong.
 *
 * Logged like every other control in this file even though nothing is
 * destroyed. One file containing every row in the workspace is what an
 * exfiltration looks like, which is exactly the reasoning capabilities.ts
 * gives for danger.backup.export being a danger-zone grant at all — so the
 * trail has to say who took one.
 */
export async function exportWorkspaceBackup(): Promise<ActionResult<BackupDownload>> {
  const actor = await requireCapability('danger.backup.export')
  if (!actor) return err(REFUSED)

  // Checked before the snapshot is built, not after: reading every table to
  // then discover there is no key is a large query for nothing. There is
  // deliberately no plaintext fallback — a backup that leaves the process
  // unencrypted is the failure this key exists to prevent.
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    return err('BACKUP_ENCRYPTION_KEY is not set — a backup never leaves the server unencrypted')
  }

  let payload: Buffer
  try {
    payload = encryptSnapshot(await buildSnapshot())
  } catch (error) {
    console.error('[danger] backup export failed', error)
    return err('Could not build the backup — try again')
  }

  if (backupTooLarge(payload.byteLength)) {
    return err(
      'This workspace is too large to download through the browser. '
      + 'Take the backup from a server-side job instead.',
    )
  }

  await logActivity({
    actorId: actor.id,
    verb: 'exported',
    entityType: 'user',
    entityId: actor.id,
    entityLabel: 'workspace backup',
    pagePath: '/admin/danger',
    detail: `${payload.byteLength} bytes, encrypted`,
  })

  return ok({
    filename: backupFilename(new Date()),
    base64: payload.toString('base64'),
    byteSize: payload.byteLength,
  })
}

// ===========================================================================
// 2. Delete one meeting — soft, straight to Trash
// ===========================================================================

/**
 * The recoverable control on this page, and the only reason it is here rather
 * than only on the meeting itself: an admin cleaning up a workspace should not
 * have to navigate to a meeting to remove it.
 *
 * deleteMeeting (features/meetings/actions.ts) does the actual work — the
 * scoped capability check against the meeting's own projects, the Google
 * Calendar cancellation for the guests, the soft delete and the activity row.
 * Delegating rather than reimplementing is what keeps the calendar half from
 * being forgotten here, and it is also why this function writes NO activity
 * row of its own: deleteMeeting already logs one, and the duplicate-log bug
 * its comment describes is exactly what a second call would recreate.
 *
 * The requireCapability below is therefore a front door, not the decision. It
 * resolves 'all' for superadmin and admin and refuses everyone else without a
 * resource to scope against, which is a stricter answer than deleteMeeting's
 * own — correct for a danger-zone entry point, and the scoped path still
 * exists on the meeting itself.
 */
export async function deleteMeetingFromDanger(
  meetingId: string,
  confirm: string,
): Promise<ActionResult<{ title: string }>> {
  const actor = await requireCapability('meeting.delete')
  if (!actor) return err(REFUSED)
  const parsedId = uuidInput.safeParse(meetingId)
  if (!parsedId.success) return err('Invalid meeting')

  const [meeting] = await db
    .select({ id: liveMeetings.id, title: liveMeetings.title })
    .from(liveMeetings)
    .where(eq(liveMeetings.id, parsedId.data))
  if (!meeting) return err('Not found, or it is already in Trash')

  const expected = deleteMeetingPhrase(meeting)
  if (!matchesConfirm(confirm, expected)) return err(`Type “${expected}” to confirm`)

  const res = await deleteMeeting(meeting.id)
  if (!res.ok) return err(res.error)

  revalidateDangerPaths()
  return ok({ title: meeting.title })
}

// ===========================================================================
// 3. Reset one project's board
// ===========================================================================

/**
 * Empties ONE project's board permanently: its sprints, its tasks, and the
 * check-ins reported against those sprints (sprint_checkins is ON DELETE
 * CASCADE from sprints, so nothing here has to name it). The project, its
 * team, its roles and its meetings all stay.
 *
 * Tasks go before sprints. tasks.sprint_id is ON DELETE SET NULL, so the other
 * order would leave every task momentarily in the backlog before removing it —
 * harmless, but it means a run that stops halfway has silently moved work
 * instead of only removing it.
 *
 * Only LIVE rows are taken. Sprints and tasks already sitting in Trash are
 * left there, and the card says so: an operator who wants those gone too has
 * a separate control for it, and quietly widening a reset into "and also
 * everything you previously trashed" is the kind of surprise a danger zone
 * exists to avoid.
 */
export async function resetApp(
  appId: string,
  confirm: string,
): Promise<ActionResult<PurgeProgress & { appName: string }>> {
  const actor = await requireCapability('danger.app.reset')
  if (!actor) return err(REFUSED)
  const parsedId = uuidInput.safeParse(appId)
  if (!parsedId.success) return err('Invalid project')

  const [app] = await db
    .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug })
    .from(liveApps)
    .where(eq(liveApps.id, parsedId.data))
  if (!app) return err('Not found, or it is already in Trash')

  const expected = resetAppPhrase(app.slug)
  if (!matchesConfirm(confirm, expected)) {
    return err(`Type the project's address “${expected}” to confirm`)
  }

  const [taskRows, sprintRows] = await Promise.all([
    db.select({ id: liveTasks.id }).from(liveTasks).where(eq(liveTasks.appId, app.id)),
    db.select({ id: liveSprints.id }).from(liveSprints).where(eq(liveSprints.appId, app.id)),
  ])
  if (taskRows.length === 0 && sprintRows.length === 0) {
    return err(`${app.name} already has an empty board`)
  }

  const queue = [
    ...taskRows.map((r) => ({ kind: 'task' as const, id: r.id })),
    ...sprintRows.map((r) => ({ kind: 'sprint' as const, id: r.id })),
  ]
  const { batch, remaining } = planBatch(queue)

  // Phase 1 — mark them. Two statements rather than one because the ids belong
  // to two tables; both are guarded on `deletedAt IS NULL` so a row somebody
  // trashed between the read above and this write is left alone rather than
  // having its deletedBy rewritten to this run.
  const at = new Date()
  const taskIds = batch.filter((j) => j.kind === 'task').map((j) => j.id)
  const sprintIds = batch.filter((j) => j.kind === 'sprint').map((j) => j.id)
  if (taskIds.length > 0) {
    await db
      .update(tasks)
      .set({ deletedAt: at, deletedBy: actor.id })
      .where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt)))
  }
  if (sprintIds.length > 0) {
    await db
      .update(sprints)
      .set({ deletedAt: at, deletedBy: actor.id })
      .where(and(inArray(sprints.id, sprintIds), isNull(sprints.deletedAt)))
  }

  // Phase 2 — the guarded hard delete, at the one site allowed to do it.
  const progress = await runPurgeBatch(
    batch.map((job) => ({
      run: () =>
        job.kind === 'task'
          ? purgeTask(job.id, PURGE_CONFIRM_PHRASE)
          : purgeSprint(job.id, PURGE_CONFIRM_PHRASE),
    })),
    remaining,
  )
  if (!progress.ok) return progress

  await logActivity({
    actorId: actor.id,
    verb: 'purged',
    entityType: 'app',
    entityId: app.id,
    entityLabel: app.name,
    appId: app.id,
    appName: app.name,
    pagePath: '/apps/' + app.slug,
    detail: `reset the board — ${progress.data.purged} sprints and tasks deleted`,
    metadata: { reset: { purged: progress.data.purged, remaining: progress.data.remaining } },
  })

  revalidatePath('/apps/' + app.slug)
  revalidatePath('/apps')
  revalidateDangerPaths()
  return ok({ ...progress.data, appName: app.name })
}

// ===========================================================================
// 4. Wipe meeting recordings
// ===========================================================================

/**
 * Destroys every LIVE screen keyframe in the workspace and the Blob object
 * behind each one. The meetings, their AI write-ups and their note segments
 * all survive — the notes stay, the evidence for them does not, which is the
 * distinction capabilities.ts draws for danger.recordings.wipe.
 *
 * SCOPE LIMIT, stated rather than hidden: meeting_recording_segments (the
 * per-five-minute transcript rows) is NOT touched. It has no deletedAt of its
 * own and no purge* action exists for it, so removing it would need a
 * db.delete in this file — which src/db/live.test.ts check 4 forbids outside
 * trash-actions.ts. The card's copy says transcripts survive rather than
 * implying a wipe that does not happen; wiring the transcript half needs a
 * purgeRecordingSegments in trash-actions.ts.
 *
 * The Blob call is purgeKeyframe's, one per row rather than one del() with an
 * array, for the same confinement reason — the batching purgeMeeting does is
 * only available to code inside that file. DANGER_BATCH_LIMIT is what keeps
 * the resulting round trips inside a function's budget.
 */
export async function wipeMeetingRecordings(confirm: string): Promise<ActionResult<PurgeProgress>> {
  const actor = await requireCapability('danger.recordings.wipe')
  if (!actor) return err(REFUSED)

  const [totalRow] = await db.select({ total: count() }).from(liveScreenshots)
  const total = totalRow?.total ?? 0
  if (total === 0) return err('There are no keyframes to wipe')

  const expected = wipeRecordingsPhrase(total)
  if (!matchesConfirm(confirm, expected)) {
    return err(`Type “${expected}” to confirm — the number is this moment's count`)
  }

  const rows = await db
    .select({ id: liveScreenshots.id })
    .from(liveScreenshots)
    .orderBy(desc(liveScreenshots.capturedAtMs))
    .limit(DANGER_BATCH_LIMIT)
  const ids = rows.map((r) => r.id)
  const remaining = Math.max(0, total - ids.length)

  await db
    .update(meetingScreenshots)
    .set({ deletedAt: new Date(), deletedBy: actor.id })
    .where(and(inArray(meetingScreenshots.id, ids), isNull(meetingScreenshots.deletedAt)))

  const progress = await runPurgeBatch(
    ids.map((id) => ({ run: () => purgeKeyframe(id, PURGE_CONFIRM_PHRASE) })),
    remaining,
  )
  if (!progress.ok) return progress

  await logActivity({
    actorId: actor.id,
    verb: 'purged',
    entityType: 'user',
    entityId: actor.id,
    entityLabel: 'meeting recordings',
    pagePath: '/admin/danger',
    detail: `${progress.data.purged} screen keyframes and their blobs deleted`,
    metadata: { wipe: { purged: progress.data.purged, remaining: progress.data.remaining } },
  })

  revalidatePath('/meetings')
  revalidateDangerPaths()
  return progress
}

// ===========================================================================
// 5. Empty the trash
// ===========================================================================

const PURGE_BY_KIND: Record<
  // 'person' is excluded for the same reason 'assignment' is: both are
  // tombstones rather than deleted rows, and purging one would mean hard
  // deleting the user and cascading their work away. Removal is undone by
  // restoring, never by emptying the bin.
  Exclude<TrashKind, 'assignment' | 'person'>,
  (id: string, confirm: string) => Promise<ActionResult>
> = {
  segment: purgeSegment,
  keyframe: purgeKeyframe,
  task: purgeTask,
  sprint: purgeSprint,
  bug: purgeBug,
  meeting: purgeMeeting,
  app: purgeApp,
}

/**
 * trash.purge applied to everything at once — which is the whole definition of
 * this control, and why it iterates the existing per-row purge actions instead
 * of growing a bulk delete of its own. Each row still gets its own guarded
 * delete, its own blob cleanup and its own activity row, so emptying the trash
 * leaves the same trail as purging every row by hand would have.
 *
 * The phrase carries the CURRENT count, so a trash that changed between the
 * page rendering and the button being pressed stops the run rather than
 * quietly destroying more than the operator read about.
 */
export async function emptyTrash(confirm: string): Promise<ActionResult<PurgeProgress>> {
  const actor = await requireCapability('danger.trash.empty')
  if (!actor) return err(REFUSED)

  const groups = await getTrash()
  const total = purgeableTrashTotal(groups)
  if (total === 0) return err('The trash is already empty')

  const expected = emptyTrashPhrase(total)
  if (!matchesConfirm(confirm, expected)) {
    return err(`Type “${expected}” to confirm — the number is this moment's count`)
  }

  // getTrash() is itself bounded (PER_SOURCE_LIMIT per kind), so `queue` is
  // already a page of the trash rather than all of it; planBatch then applies
  // this file's own ceiling on top.
  const queue = purgeQueue(groups)
  const { batch } = planBatch(queue)
  const remaining = Math.max(0, total - batch.length)

  const progress = await runPurgeBatch(
    batch.map((job) => ({
      // The cast tracks PURGEABLE_TRASH_KINDS, which lists neither tombstone
      // kind: 'assignment' has no purge action, and 'person' must never have
      // one (purging a removal would mean hard-deleting the user).
      run: () =>
        PURGE_BY_KIND[job.kind as Exclude<TrashKind, 'assignment' | 'person'>](
          job.id,
          PURGE_CONFIRM_PHRASE,
        ),
    })),
    remaining,
  )
  if (!progress.ok) return progress

  await logActivity({
    actorId: actor.id,
    verb: 'purged',
    entityType: 'user',
    entityId: actor.id,
    entityLabel: 'the trash',
    pagePath: '/admin/danger',
    detail: `${progress.data.purged} trashed items deleted permanently`,
    metadata: { emptyTrash: { purged: progress.data.purged, remaining: progress.data.remaining } },
  })

  revalidatePath('/admin/trash')
  revalidateDangerPaths()
  return progress
}

// ===========================================================================
// What the page needs to render the controls
// ===========================================================================

export type DangerTargets = {
  trashCount: number
  keyframeCount: number
  apps: { id: string; name: string; slug: string; taskCount: number; sprintCount: number }[]
  meetings: { id: string; title: string; startsAt: Date }[]
}

/** The meeting picker is a list, not a search, so it is bounded like one. */
const MEETING_PICKER_LIMIT = 50

/**
 * ONE guarded read for the whole page.
 *
 * It lives in a 'use server' module — and is therefore a callable endpoint —
 * rather than in a *-queries.ts, because the confirmation phrases the actions
 * check are built from these same counts: keeping the read in one place is
 * what stops the page's number and the action's number being computed two
 * different ways. Each block is skipped for an actor who does not hold the
 * control it feeds, so nobody learns a count for a button they cannot press.
 */
export async function loadDangerTargets(): Promise<ActionResult<DangerTargets>> {
  const actor = await requireCapability('admin.view')
  if (!actor) return err(REFUSED)

  const [trashGroups, keyframeRows, appRows, meetingRows] = await Promise.all([
    can(actor, 'danger.trash.empty') ? getTrash() : Promise.resolve([]),
    can(actor, 'danger.recordings.wipe')
      ? db.select({ total: count() }).from(liveScreenshots)
      : Promise.resolve([]),
    can(actor, 'danger.app.reset')
      ? db
          .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug })
          .from(liveApps)
          .orderBy(liveApps.name)
      : Promise.resolve([]),
    can(actor, 'meeting.delete')
      ? db
          .select({
            id: liveMeetings.id,
            title: liveMeetings.title,
            startsAt: liveMeetings.startsAt,
          })
          .from(liveMeetings)
          .orderBy(desc(liveMeetings.startsAt))
          .limit(MEETING_PICKER_LIMIT)
      : Promise.resolve([]),
  ])

  // Per-app board sizes in two grouped queries rather than two per app — the
  // same rule listApps follows (features/apps/queries.ts): a picker that costs
  // a round trip per project is a picker that gets slower as the workspace
  // grows.
  const appIds = appRows.map((a) => a.id)
  const [taskCounts, sprintCounts] =
    appIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({ appId: liveTasks.appId, total: count() })
            .from(liveTasks)
            .where(inArray(liveTasks.appId, appIds))
            .groupBy(liveTasks.appId),
          db
            .select({ appId: liveSprints.appId, total: count() })
            .from(liveSprints)
            .where(inArray(liveSprints.appId, appIds))
            .groupBy(liveSprints.appId),
        ])
  const tasksByApp = new Map(taskCounts.map((r) => [r.appId, r.total]))
  const sprintsByApp = new Map(sprintCounts.map((r) => [r.appId, r.total]))

  return ok({
    trashCount: purgeableTrashTotal(trashGroups),
    keyframeCount: keyframeRows[0]?.total ?? 0,
    apps: appRows.map((a) => ({
      ...a,
      taskCount: tasksByApp.get(a.id) ?? 0,
      sprintCount: sprintsByApp.get(a.id) ?? 0,
    })),
    meetings: meetingRows,
  })
}
