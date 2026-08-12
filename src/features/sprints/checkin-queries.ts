import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { sprintCheckins, users } from '@/db/schema'

export type SprintCheckinRow = {
  sprintId: string
  userId: string
  userName: string
  userAvatarUrl: string | null
  percent: number
  note: string | null
  /** When the person last said this — the staleness signal the meeting
   *  surface renders ("checked in 3 days ago"), see db/schema.ts. */
  updatedAt: Date
}

const checkinSelection = {
  sprintId: sprintCheckins.sprintId,
  userId: sprintCheckins.userId,
  userName: users.name,
  userAvatarUrl: users.avatarUrl,
  percent: sprintCheckins.percent,
  note: sprintCheckins.note,
  updatedAt: sprintCheckins.updatedAt,
}

/**
 * Every check-in on one sprint, with the reporter's name/avatar for display.
 * Inner join: sprint_checkins.user_id always references a real users row
 * (accounts are deactivated, never deleted), so left-join null handling
 * would be dead code. Ordered by name so the list reads like a roster, not
 * like insertion order.
 */
export async function getSprintCheckins(sprintId: string): Promise<SprintCheckinRow[]> {
  return db
    .select(checkinSelection)
    .from(sprintCheckins)
    .innerJoin(users, eq(sprintCheckins.userId, users.id))
    .where(eq(sprintCheckins.sprintId, sprintId))
    .orderBy(asc(users.name))
}

/**
 * Check-ins for a whole set of sprints in ONE query, grouped by sprint —
 * the meeting-prep surface renders several sprints side by side, and calling
 * getSprintCheckins in a loop would be the exact N+1 revalidateApps in
 * task-actions.ts exists to avoid.
 *
 * The map only has entries for sprints that HAVE check-ins; callers read
 * `map.get(id) ?? []` rather than relying on every requested id being
 * present — same contract as any grouped lookup, and it keeps this function
 * from inventing empty arrays for ids that were never sprints at all.
 */
export async function getCheckinsForSprints(
  sprintIds: string[],
): Promise<Map<string, SprintCheckinRow[]>> {
  const grouped = new Map<string, SprintCheckinRow[]>()
  // Guard the empty selection: nothing to fetch, and inArray with an empty
  // list is not a query worth sending.
  if (sprintIds.length === 0) return grouped

  const rows = await db
    .select(checkinSelection)
    .from(sprintCheckins)
    .innerJoin(users, eq(sprintCheckins.userId, users.id))
    .where(inArray(sprintCheckins.sprintId, sprintIds))
    // Sprint first so each group is contiguous, then name for the same
    // roster order getSprintCheckins uses.
    .orderBy(asc(sprintCheckins.sprintId), asc(users.name))

  for (const row of rows) {
    const group = grouped.get(row.sprintId)
    if (group) group.push(row)
    else grouped.set(row.sprintId, [row])
  }
  return grouped
}
