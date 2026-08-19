import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { dailyWorklogs, meetings, sprints, tasks } from '@/db/schema'

/**
 * Applying an approved change request.
 *
 * A CLOSED REGISTRY, one applier per entity type, not a generic "apply any
 * diff". Two reasons, both structural rather than stylistic:
 *
 *  - `src/db/index.ts` is neon-http, so `db.transaction()` does not exist.
 *    The house substitute is `db.batch([...])`, which needs a statically
 *    built array of statements — a diff of arbitrary shape cannot produce one.
 *  - An unsupported entity type must fail loudly when the request is FILED,
 *    not silently when someone approves it a week later.
 */
export const SUPPORTED_ENTITY_TYPES = ['task', 'sprint', 'meeting', 'worklog'] as const
export type SupportedEntityType = (typeof SUPPORTED_ENTITY_TYPES)[number]

export function isSupportedEntityType(value: string): value is SupportedEntityType {
  return (SUPPORTED_ENTITY_TYPES as readonly string[]).includes(value)
}

/**
 * Whether the target still looks the way it did when the request was filed.
 *
 * Returns the name of the first field that moved, or null if the row still
 * matches. This is field-by-field against a stored pre-image rather than a
 * version column because NONE of the target tables has an `updatedAt` to
 * compare — `apps`, `tasks`, `sprints` and `meetings` all lack one.
 *
 * Approving a stale request must fail loudly. The alternative is silently
 * clobbering whatever someone else changed in the meantime, which is the one
 * outcome an approval workflow exists to prevent.
 */
export function detectConflict(
  before: Record<string, unknown>,
  current: Record<string, unknown> | null,
): string | null {
  if (current === null) return 'row no longer exists'
  for (const [field, was] of Object.entries(before)) {
    const now = current[field]
    // Dates arrive as Date from the driver and as ISO strings from jsonb.
    const a = was instanceof Date ? was.toISOString() : was
    const b = now instanceof Date ? now.toISOString() : now
    if (JSON.stringify(a) !== JSON.stringify(b)) return field
  }
  return null
}

const TABLES = {
  task: tasks,
  sprint: sprints,
  meeting: meetings,
  worklog: dailyWorklogs,
} as const

/** The one statement that applies an approved edit. Fed straight into db.batch. */
export function buildApplyStatement(
  entityType: SupportedEntityType,
  entityId: string,
  after: Record<string, unknown>,
) {
  const table = TABLES[entityType]
  return db.update(table).set(after).where(eq(table.id, entityId))
}
