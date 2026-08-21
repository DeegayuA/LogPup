import { ROLE_GRANTS, type Action } from '@/features/auth/capabilities'

/**
 * Which capabilities survive an active maintenance window.
 *
 * The freeze stops WRITES. Reading is deliberately untouched — see the note on
 * canWrite in src/db/write-gate.ts — so every action that only looks at
 * something has to keep working, or a maintenance window would blank the very
 * screens telling people why the app is quiet.
 *
 * The classifier is a pattern, not a hand-kept list, because a hand-kept list
 * of 61 actions goes stale the first time somebody adds the 62nd and nothing
 * complains. `.view` is how this codebase already names its reads; the single
 * exception is stated below with its reason, and write-actions.test.ts fails if
 * that exception ever stops naming a real action.
 */
const READ_SEGMENT = /(^|\.)view(\.|$)/

/**
 * Reads that do not say "view", each with the reason it is here.
 *
 * danger.backup.export writes a file, not a row — and it is the thing you do
 * BEFORE maintenance, so a window must never be what stops you taking the
 * backup you are taking because of the window.
 */
export const MAINTENANCE_ALLOWED_WRITES: readonly Action[] = ['danger.backup.export']

/** Would this action change something a maintenance freeze should stop? */
export function isFrozenByMaintenance(action: Action): boolean {
  if (READ_SEGMENT.test(action)) return false
  return !MAINTENANCE_ALLOWED_WRITES.includes(action)
}

/** Every action the freeze lets through. Exported for the drift test. */
export function actionsAllowedDuringMaintenance(): Action[] {
  return (Object.keys(ROLE_GRANTS) as Action[]).filter((action) => !isFrozenByMaintenance(action))
}
