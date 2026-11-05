import { z } from 'zod'
import { eventChipClassesForSlot, eventDotClassesForSlot } from '@/features/meetings/event-color'

/**
 * Pure rules for task labels and components, shared by labels-actions.ts (the
 * server) and task-tags-field.tsx (the client) so the two can never disagree
 * on what a valid name is or what colour a slot paints.
 *
 * Not a 'use server' file on purpose: a server-action module may only export
 * async functions, and these have to be importable from a client component.
 */

/** Same eight hues as the calendar (event-color.ts, --event-1..8). */
export const LABEL_SLOT_COUNT = 8

/** One task carries at most this many of each. A cap on one request's rows. */
export const MAX_TAGS_PER_TASK = 20

export const MAX_TAG_NAME_LENGTH = 40

/**
 * Trim, and collapse inner runs of whitespace. Collapsing matters because the
 * unique index is on lower(name) only: without it "Front  end" and "Front end"
 * would be two labels that look identical on a card.
 */
export function normaliseTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export const tagNameSchema = z
  .string()
  .transform(normaliseTagName)
  .pipe(
    z
      .string()
      .min(1, 'Give it a name')
      .max(MAX_TAG_NAME_LENGTH, `Keep it to ${MAX_TAG_NAME_LENGTH} characters`),
  )

/**
 * The comparison key the database's unique index uses (lower(name)). The
 * pre-check in createLabel and the client's "is this name new?" test both go
 * through here so the "Create “xyz”" option disappears for exactly the names
 * the insert would refuse.
 */
export function tagNameKey(name: string): string {
  return normaliseTagName(name).toLowerCase()
}

export function hasTagNamed(existing: readonly { name: string }[], name: string): boolean {
  const key = tagNameKey(name)
  return existing.some((tag) => tagNameKey(tag.name) === key)
}

/**
 * Round-robin over the eight slots by how many labels the project already has.
 *
 * Positional rather than hashed from the id, unlike event-color.ts: a label's
 * slot is STORED at creation, so it never repaints when siblings come and go
 * (the problem the calendar's hash exists to avoid), and round-robin is what
 * keeps a project's first eight labels all different colours.
 */
export function nextLabelSlot(existingCount: number): number {
  const n = Number.isFinite(existingCount) && existingCount > 0 ? Math.floor(existingCount) : 0
  return n % LABEL_SLOT_COUNT
}

/** Replace-the-set as the two statements it actually needs. Duplicates ignored. */
export function diffTagSet(
  current: readonly string[],
  next: readonly string[],
): { add: string[]; remove: string[] } {
  const currentSet = new Set(current)
  const nextSet = new Set(next)
  return {
    add: [...nextSet].filter((id) => !currentSet.has(id)),
    remove: [...currentSet].filter((id) => !nextSet.has(id)),
  }
}

/**
 * The activity row's detail: "+Bug, −UI". Names, not ids — the feed is read
 * by people — and capped, because a trail line that wraps three times is one
 * nobody reads.
 */
export function tagChangeDetail(
  noun: 'labels' | 'components',
  added: readonly string[],
  removed: readonly string[],
): string {
  const parts = [...added.map((n) => `+${n}`), ...removed.map((n) => `−${n}`)]
  const shown = parts.slice(0, 4).join(', ')
  const more = parts.length > 4 ? ` and ${parts.length - 4} more` : ''
  return `${noun}: ${shown}${more}`
}

// Colours come from event-color.ts, the ONE identity palette (stored slot
// 0-7 → its 1..8). Never a local copy: two tables drift the day a token moves.

const NEUTRAL_CHIP = 'border-border bg-muted/50 text-foreground'
const NEUTRAL_DOT = 'bg-muted-foreground/40'

function validSlot(slot: number | null | undefined): slot is number {
  return typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < LABEL_SLOT_COUNT
}

/** A null or out-of-range slot (a hand-edited row) renders neutral, never a guess. */
export function labelChipClasses(slot: number | null | undefined): string {
  return (validSlot(slot) && eventChipClassesForSlot(slot + 1)) || NEUTRAL_CHIP
}

export function labelDotClasses(slot: number | null | undefined): string {
  return (validSlot(slot) && eventDotClassesForSlot(slot + 1)) || NEUTRAL_DOT
}

/** Toggle one id in a selection, keeping pick order. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}
