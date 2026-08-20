// Pure, DB-free logic for /admin/danger: which phrase each control demands
// typed, what each one destroys versus leaves standing, and how much work one
// invocation is allowed to take on.
//
// It lives here rather than in danger-actions.ts because that is a 'use
// server' module — it may export nothing but async functions, so a constant or
// a synchronous helper simply cannot live there. And it lives here rather than
// in the card components because BOTH sides have to check the same phrase:
// two literals that agree today are the drift trash-actions.ts's CONFIRM_PHRASE
// comment describes, where a stricter server phrase enables a button on text
// the action then rejects.
//
// Zero imports beyond types, so danger-logic.test.ts needs no mocking at all.

import type { TrashGroup, TrashKind } from '@/features/admin/trash-grouping'

// ---------------------------------------------------------------------------
// Typed confirmations
// ---------------------------------------------------------------------------

/**
 * THE RULE THIS FILE ENFORCES: no danger-zone phrase is a constant word.
 *
 * "DELETE" is muscle memory after the second use, and the mistake these
 * controls guard against is never "meant to keep it" — it is "ran it on the
 * wrong thing" or "ran it again without looking". So every phrase is derived
 * from the target in front of the person: an app's own address, a meeting's
 * own title, or — for the two workspace-wide controls, which have no target to
 * name — the CURRENT count of what is about to go. A count cannot be typed
 * from memory of a previous run, and it doubles as an interlock: if the number
 * moved between the page rendering and the button being pressed, the phrase
 * the server computes no longer matches what was typed, and the run stops.
 */
export function normalizeConfirm(typed: string): string {
  return typed.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Case- and whitespace-insensitive on purpose. The phrase's job is to prove
 * somebody read the target in front of them, not to test their shift key —
 * failing a correct-but-differently-cased meeting title would train people to
 * copy-paste, which defeats the reading.
 *
 * An empty expected phrase never matches anything, so a target with a blank
 * name can't be confirmed by leaving the box empty.
 */
export function matchesConfirm(typed: string, expected: string): boolean {
  const want = normalizeConfirm(expected)
  return want !== '' && normalizeConfirm(typed) === want
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "empty 37 items" — recomputed server-side against the trash as it is now. */
export function emptyTrashPhrase(itemCount: number): string {
  return `empty ${plural(itemCount, 'item', 'items')}`
}

/** "wipe 412 keyframes" — same interlock, against the live keyframe count. */
export function wipeRecordingsPhrase(keyframeCount: number): string {
  return `wipe ${plural(keyframeCount, 'keyframe', 'keyframes')}`
}

/**
 * The project's address, exactly as DeleteAppCard already demands it
 * (src/features/apps/components/delete-app-card.tsx). Same phrase for the same
 * reason: it names WHICH project, which is the error being guarded against.
 */
export function resetAppPhrase(slug: string): string {
  return slug
}

/**
 * The meeting's title, falling back to its id when the title is blank — a
 * meeting with no title has nothing else that identifies it, and an
 * un-typeable phrase would make the control unusable rather than safe.
 */
export function deleteMeetingPhrase(meeting: { title: string; id: string }): string {
  return meeting.title.trim() === '' ? meeting.id : meeting.title
}

// ---------------------------------------------------------------------------
// What each control destroys, and what survives it
// ---------------------------------------------------------------------------

/**
 * Every control states both halves before it runs. `survives` is not padding:
 * the whole reason these are separate controls rather than one "clear
 * everything" is that they differ in what they leave standing, and an operator
 * choosing between them is choosing exactly that.
 */
export type BlastRadius = {
  destroys: readonly string[]
  survives: readonly string[]
  /** False means no restore, no Trash, no backup short of a fresh export. */
  reversible: boolean
}

export function backupSummary(): BlastRadius {
  return {
    destroys: [],
    survives: ['Everything — this reads the workspace, it never writes to it'],
    reversible: true,
  }
}

export function deleteMeetingSummary(title: string): BlastRadius {
  return {
    destroys: [
      `“${title}” disappears from the calendar, search and every dashboard`,
      'Its Google Calendar invite is cancelled for the guests',
    ],
    survives: [
      'The meeting itself, in Trash — notes, keyframes and attendees intact',
      'Its projects, and every other meeting on them',
    ],
    reversible: true,
  }
}

export function resetAppSummary(
  appName: string,
  counts: { sprints: number; tasks: number },
): BlastRadius {
  return {
    destroys: [
      `${plural(counts.tasks, 'task', 'tasks')} on ${appName}, permanently`,
      `${plural(counts.sprints, 'sprint', 'sprints')} and every check-in reported against them`,
    ],
    survives: [
      'The project itself, its team, its roles and its settings',
      'Its meetings, notes and the whole activity trail',
      'Anything already in Trash — empty the Trash separately for that',
    ],
    reversible: false,
  }
}

export function wipeRecordingsSummary(keyframeCount: number): BlastRadius {
  return {
    destroys: [
      `${plural(keyframeCount, 'screen keyframe', 'screen keyframes')} across every meeting`,
      'The image behind each one, in Blob storage',
    ],
    survives: [
      'Every meeting, and every AI write-up and note segment produced from them',
      'Recording transcripts — text segments are not touched (see BLOCKED below)',
    ],
    reversible: false,
  }
}

export function emptyTrashSummary(itemCount: number): BlastRadius {
  return {
    destroys: [
      `${plural(itemCount, 'trashed item', 'trashed items')} — projects, meetings, tasks, sprints, notes and keyframes`,
      'The Blob objects behind any trashed keyframe',
    ],
    survives: [
      'Everything still live — the trash is the only thing this reads',
      'Removed assignments, which are history rather than rows and stay listed',
    ],
    reversible: false,
  }
}

// ---------------------------------------------------------------------------
// Trash iteration
// ---------------------------------------------------------------------------

/**
 * Deepest child first, container last. Purging a meeting cascade-deletes its
 * note segments and keyframes (schema.ts), and purging an app takes its
 * sprints and tasks — so a container-first order would leave the later calls
 * pointed at rows Postgres had already removed, reporting "nothing purged" for
 * work that in fact happened.
 *
 * 'assignment' is deliberately absent: an assignment's trash record is a still
 * open assignment_history tombstone, not a soft-deleted row, and there is no
 * purgeAssignment to call. Emptying the trash leaves that history alone, which
 * is what emptyTrashSummary says out loud.
 */
export const PURGEABLE_TRASH_KINDS: readonly TrashKind[] = [
  'segment',
  'keyframe',
  'task',
  'sprint',
  'meeting',
  'app',
]

/** How many trashed rows emptying the trash would actually act on. */
export function purgeableTrashTotal(groups: readonly TrashGroup[]): number {
  return groups
    .filter((g) => PURGEABLE_TRASH_KINDS.includes(g.kind))
    .reduce((sum, g) => sum + g.totalCount, 0)
}

/** Flattens the trash into (kind, id) pairs in PURGEABLE_TRASH_KINDS order. */
export function purgeQueue(groups: readonly TrashGroup[]): { kind: TrashKind; id: string }[] {
  const byKind = new Map(groups.map((g) => [g.kind, g] as const))
  return PURGEABLE_TRASH_KINDS.flatMap((kind) =>
    (byKind.get(kind)?.rows ?? []).map((row) => ({ kind, id: row.id })),
  )
}

// ---------------------------------------------------------------------------
// Bounded work
// ---------------------------------------------------------------------------

/**
 * One invocation's ceiling.
 *
 * Every permanent delete here runs through the purge* actions in
 * trash-actions.ts — the one file allowed to hard-delete (src/db/live.test.ts
 * check 4) — and each of those is four or five sequential round trips of its
 * own plus, for a keyframe, a Vercel Blob call. Fifty of them is already the
 * upper end of what fits inside a serverless function's budget, so the
 * remainder is reported back rather than attempted: "purged 50, 290 to go"
 * with a button that runs again is a truthful slow answer, where one
 * unbounded loop is a timeout that leaves the operator guessing how far it
 * got.
 *
 * 50 also matches PER_SOURCE_LIMIT in trash-queries.ts, which is what bounds
 * how many trashed rows getTrash() can hand over per kind in the first place.
 */
export const DANGER_BATCH_LIMIT = 50

export function planBatch<T>(
  items: readonly T[],
  limit: number = DANGER_BATCH_LIMIT,
): { batch: T[]; remaining: number } {
  const size = Math.max(0, Math.trunc(limit))
  return { batch: items.slice(0, size), remaining: Math.max(0, items.length - size) }
}

/** What every batched danger action reports back. */
export type PurgeProgress = {
  /** Rows this run actually destroyed. */
  purged: number
  /** Rows that were already gone — cascaded away by an earlier purge in the
   *  same run, or restored by somebody else while this ran. Not a failure. */
  skipped: number
  /** Rows still waiting, either over the batch ceiling or added since. */
  remaining: number
}

export function purgeProgressMessage(
  progress: PurgeProgress,
  noun: { one: string; many: string },
): string {
  const head = `Deleted ${plural(progress.purged, noun.one, noun.many)}`
  const tail = progress.remaining > 0 ? ` — ${progress.remaining} still to go, run it again` : ''
  return head + tail
}

// ---------------------------------------------------------------------------
// Backup download
// ---------------------------------------------------------------------------

/**
 * A server action's result crosses the wire as part of the response body, and
 * Vercel caps that at 4.5MB. An encrypted snapshot of a real workspace can
 * pass that (the same ceiling the read-aloud path ran into), and what a person
 * gets when it does is an opaque platform error rather than a message they can
 * act on — so the size is checked here and refused in words instead.
 *
 * 4MB, not 4.5: base64 is the wire form, and the JSON envelope plus React's
 * action encoding both ride on top of the payload.
 */
export const MAX_BACKUP_DOWNLOAD_BYTES = 4 * 1024 * 1024

export function backupTooLarge(byteSize: number): boolean {
  return byteSize > MAX_BACKUP_DOWNLOAD_BYTES
}

/**
 * `.enc` rather than `.json`, because it is not JSON: backup.ts encrypts the
 * snapshot with AES-256-GCM before it ever leaves the process, and a file
 * named .json that no editor can open is a support question waiting to happen.
 * The timestamp is UTC and colon-free so the name is valid on every filesystem.
 */
export function backupFilename(at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z')
  return `logpup-backup-${stamp}.json.enc`
}

export function formatBytes(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KB`
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
}
