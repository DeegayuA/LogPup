import { can, type UserRole } from '@/features/auth/capabilities'

/**
 * Whether this person may move that task on the board.
 *
 * Signature deliberately unchanged: this is called from a CLIENT component
 * (board-column.tsx) and per row inside a map (task-actions.ts), so it cannot
 * become async and cannot take a resolved scope set. It builds an actor with
 * an EMPTY scope and asks the matrix.
 *
 * Consequence, stated rather than hidden: for a `manager` or `editor` whose
 * grant on `task.move` is 'scoped', this answers only the ownership half. It
 * therefore UNDER-grants — it can hide a control someone is in fact allowed to
 * use, and it can never show one they are not. The server action re-checks
 * with the real scope, which is where authorization actually happens; this is
 * presentation, and presentation is allowed to be conservative.
 */
export function canMoveTask(
  role: UserRole,
  userId: string,
  assigneeId: string | null,
): boolean {
  return can(
    { id: userId, role, scopeAppIds: new Set() },
    'task.move',
    { ownerId: assigneeId },
  )
}
