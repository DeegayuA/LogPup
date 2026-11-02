import type { TaskStatus } from '@/features/sprints/board-view'

/**
 * The tick beside a child in its parent's list is a two-state control on a
 * twelve-state workflow. Ticking means "done" from anywhere; unticking sends
 * it back to "To do" rather than guessing which in-flight step it came from —
 * the board's drag and the dialog stay the way to place it precisely.
 */
export function childToggleTarget(status: TaskStatus): TaskStatus {
  return status === 'done' ? 'todo' : 'done'
}

/** Child id → the status a tick set locally, ahead of the server's repaint. */
export type StatusOverrides = Readonly<Record<string, TaskStatus>>

/**
 * The list as the parent shows it: ticks applied over the snapshot, so the
 * strike-through and the "x done" count move with the ✓, not a refresh later.
 */
export function withStatusOverrides<T extends { id: string; status: TaskStatus }>(
  items: readonly T[],
  overrides: StatusOverrides,
): T[] {
  return items.map((c) => (c.id in overrides ? { ...c, status: overrides[c.id] } : c))
}
