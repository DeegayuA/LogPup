import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { assignments } from '@/db/schema'
import { isProjectManagerRole } from '@/lib/project-roles'

// Same guard class as visibility.ts's — see managedAppIdsFor below.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

/**
 * The same question over a SET of projects: does this person run ANY of them?
 *
 * ANY, not all. A meeting can serve several projects, and being PM of one of
 * them is enough to manage that meeting — requiring all of them would mean a
 * joint meeting could only be managed by someone who runs every project in it.
 * That is not a new opinion: capabilities.ts's `Resource.appIds` arm already
 * decides scope the same way, and its comment names a multi-project meeting as
 * the live case.
 *
 * ONE query with inArray, never one per project: the meeting gates run this on
 * every read of a meeting surface.
 *
 * Same definition of "manager" as managesApp above — isProjectManagerRole over
 * the free-text assignments.role. Never write a private role check, and never
 * widen it to leads/architects, who stay reviewers deliberately.
 */
export async function managesAnyApp(
  userId: string,
  appIds: readonly string[] | null | undefined,
): Promise<boolean> {
  if (!appIds || appIds.length === 0) return false
  const rows = await db
    .select({ role: assignments.role })
    .from(assignments)
    .where(and(eq(assignments.userId, userId), inArray(assignments.appId, [...appIds])))
  return rows.some((row) => isProjectManagerRole(row.role))
}

/**
 * Every app this person runs, as ids — the batched form of the question
 * above, for surfaces that must answer "may they read intel on THIS meeting"
 * many times per page without a query per meeting. /meetings resolves this
 * once and threads it into decideIntelReadable (glance-core.ts), which
 * rebuilds canReadMeetingIntel's PM arm from it. Same definition of
 * "manager" as managesApp — isProjectManagerRole, never a private check.
 */
export async function managedAppIdsFor(userId: string): Promise<string[]> {
  // visibility.ts's rule, for visibility.ts's reason: comparing a non-uuid
  // (the signed-out '' fallback especially) against a uuid column is a
  // Postgres cast error, and /meetings runs this in parallel with the layout
  // redirect — not-signed-in-enough must answer [], never become a 500.
  if (!UUID_RE.test(userId)) return []
  const rows = await db
    .select({ appId: assignments.appId, role: assignments.role })
    .from(assignments)
    .where(eq(assignments.userId, userId))
  return rows.filter((row) => isProjectManagerRole(row.role)).map((row) => row.appId)
}
