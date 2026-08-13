import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { assignments } from '@/db/schema'
import { isProjectManagerRole } from '@/lib/project-roles'

/**
 * Whether this person runs this project — i.e. their assignment on the app
 * carries a manager-family role (see isProjectManagerRole, whose patterns
 * are the single test-pinned definition).
 *
 * The studio's rule: the project manager manages everything in the project
 * and its meetings; the lead/architect only review and give feedback — they
 * are busy people, and routing every meeting edit through an admin or the
 * meeting's creator made the PM ask someone else to run their own project.
 *
 * Used to EXTEND the admin-or-creator gates (canManageMeeting in both
 * meetings/actions.ts and meetings/ai-actions.ts, canReadMeetingIntel, and
 * updateApp). It never narrows anything: an admin or creator keeps every
 * right they had. Deliberately NOT wired into createApp/deleteApp — those
 * stay admin-only.
 *
 * `assignments` is live state with no deletedAt (see schema.ts), so the
 * direct read is correct under the soft-delete rules.
 */
export async function managesApp(
  userId: string,
  appId: string | null | undefined,
): Promise<boolean> {
  if (!appId) return false
  const [row] = await db
    .select({ role: assignments.role })
    .from(assignments)
    .where(and(eq(assignments.userId, userId), eq(assignments.appId, appId)))
  return row ? isProjectManagerRole(row.role) : false
}
