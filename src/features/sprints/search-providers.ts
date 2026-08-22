import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { effectiveGrant, type GrantLevel } from '@/features/auth/capabilities'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'

/**
 * Tasks and sprints in the command center.
 *
 * Both read the live_* subqueries from db/live.ts, never the base tables:
 * tasks and sprints are soft-deleted, and a trashed row that stays findable in
 * the palette is a row the admin trash says is gone. The inner join to `apps`
 * is what supplies the board href — a task with no app cannot be linked to.
 *
 * BOTH ARE GATED ON `app.view`, not on a board permission of their own. A task
 * and a sprint are visible because the project they sit in is: there is no
 * task.view row in the matrix, and gating on `task.edit` instead would hide a
 * teammate's card from the member who can read it on the board every day.
 * `app.view` is 'scoped' for editors, members and stakeholders, so those three
 * seats see the boards of their own projects and no others.
 */

/**
 * How far this searcher reaches over projects, resolved once for both
 * providers below.
 *
 * They ask the identical question, so it is answered in one place rather than
 * twice with two chances to disagree. `loadActor()` rather than `ctx.user.role`
 * alone: an employment stage can narrow a seat's grant (capabilities.ts
 * `capFor`) and the scope set is a database read the session cannot carry. It
 * is react-cached, so the two providers running in parallel share a single
 * resolution.
 *
 * `null` means "reaches nothing" and must be answered WITHOUT a query — which
 * is a different answer from an empty scope list, and is why this is not just
 * an array.
 */
async function appReach(): Promise<{ level: GrantLevel; appIds: string[] } | null> {
  // Imported HERE, inside the call, not at module scope. A static import of
  // anything that reaches next-auth kills registry.test.ts at IMPORT time with
  // "Cannot find module 'next/server'" — a crash in the guard that protects
  // this plane, not a type error. The rule and the full story are in
  // features/intel/commands.ts. Node caches the module, so this resolves once
  // per process, not once per keystroke.
  const { loadActor } = await import('@/features/auth/actor')
  const actor = await loadActor()
  if (!actor) return null
  const level = effectiveGrant(actor.role, actor.employmentType, 'app.view')
  if (level === 'none') return null
  const appIds = [...actor.scopeAppIds]
  // A scoped seat holding no projects reaches nothing. Said here so the palette
  // does not spend a Neon round trip per keystroke on a WHERE already known to
  // be false.
  if (level === 'scoped' && appIds.length === 0) return null
  return { level, appIds }
}

export const searchProviders: SearchProvider[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    rank: 30,
    search: async (query, ctx) => {
      const reach = await appReach()
      if (!reach) return []

      const visible =
        reach.level === 'all'
          ? undefined
          : reach.level === 'scoped'
            ? inArray(liveTasks.appId, reach.appIds)
            // 'own' is unused by today's matrix and written out anyway, so a
            // one-word change to the app.view row cannot silently fall through
            // to "no filter". A task belongs to whoever is carrying it, which
            // is the same column deadline.set resolves ownership against.
            : eq(liveTasks.assigneeId, ctx.user.id)

      const rows = await db
        .select({
          id: liveTasks.id,
          title: liveTasks.title,
          status: liveTasks.status,
          sprintId: liveTasks.sprintId,
          appName: liveApps.name,
          appSlug: liveApps.slug,
        })
        .from(liveTasks)
        .innerJoin(liveApps, eq(liveTasks.appId, liveApps.id))
        // Narrowed in the WHERE, never over the rows that come back: LIMIT 6
        // applied ahead of an authorisation filter returns a page that has
        // already discarded everything the searcher was allowed to see, and
        // that reads as "no results" rather than as a bug.
        .where(and(visible, ilike(liveTasks.title, likePattern(query))))
        // asc(status) is todo → in_progress → done, by the pg enum's
        // declaration order: unfinished work first.
        .orderBy(asc(liveTasks.status))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((task) => ({
        id: task.id,
        title: task.title,
        subtitle: task.appName,
        // `backlog` is the board's sentinel for a task on no sprint.
        href: `/apps/${task.appSlug}?tab=roadmap&sprint=${task.sprintId ?? 'backlog'}`,
        status: task.status,
        kind: 'task' as const,
      }))
    },
  },
  {
    id: 'sprints',
    label: 'Sprints',
    rank: 40,
    // The one provider that takes no `ctx`: its only identity-dependent arm is
    // the 'own' one below, and that one refuses rather than answers.
    search: async (query) => {
      const reach = await appReach()
      if (!reach) return []
      // 'own' FAILS CLOSED HERE, and deliberately does not borrow the app's
      // owner. A sprint has no owner column — it is a span of a project's
      // board, not anybody's row — so there is no honest answer to "your own
      // sprints", and answering it with "sprints of projects you run" would
      // quietly hand back a scoped result under an ownership grant. If the
      // matrix ever narrows app.view to 'own', this group goes empty until
      // somebody decides what a sprint of one's own would mean.
      if (reach.level === 'own') return []

      const visible =
        reach.level === 'all' ? undefined : inArray(liveSprints.appId, reach.appIds)

      const pattern = likePattern(query)
      const rows = await db
        .select({
          id: liveSprints.id,
          name: liveSprints.name,
          status: liveSprints.status,
          appName: liveApps.name,
          appSlug: liveApps.slug,
        })
        .from(liveSprints)
        .innerJoin(liveApps, eq(liveSprints.appId, liveApps.id))
        // The goal is searched as well as the name: people remember what a
        // sprint was for long after they forget it was called "Sprint 12".
        // The scope arm sits in the same WHERE for the reason the tasks
        // provider states — a LIMIT ahead of the filter returns a short page
        // of the wrong rows.
        .where(and(visible, or(ilike(liveSprints.name, pattern), ilike(liveSprints.goal, pattern))))
        .orderBy(asc(liveSprints.status))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((sprint) => ({
        id: sprint.id,
        title: sprint.name,
        subtitle: sprint.appName,
        href: `/apps/${sprint.appSlug}?tab=roadmap&sprint=${sprint.id}`,
        status: sprint.status,
        kind: 'sprint' as const,
      }))
    },
  },
]
