import { asc, eq, ilike, or } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'

/**
 * Tasks and sprints in the command center.
 *
 * Both read the live_* subqueries from db/live.ts, never the base tables:
 * tasks and sprints are soft-deleted, and a trashed row that stays findable in
 * the palette is a row the admin trash says is gone. The inner join to `apps`
 * is what supplies the board href — a task with no app cannot be linked to.
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    rank: 30,
    search: async (query) => {
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
        .where(ilike(liveTasks.title, likePattern(query)))
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
    search: async (query) => {
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
        .where(or(ilike(liveSprints.name, pattern), ilike(liveSprints.goal, pattern)))
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
