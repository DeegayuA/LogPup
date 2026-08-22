import { and, asc, eq, or, ilike, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps } from '@/db/live'
import { effectiveGrant } from '@/features/auth/capabilities'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'

/**
 * Apps in the command center.
 *
 * Reads `liveApps`, never the base table. `apps` became soft-deletable while
 * this provider was being written, and a trashed app that stays findable in
 * ⌘K is one the admin Trash says is gone — the exact leak the registry exists
 * to prevent. Archived is a different thing and stays findable on purpose:
 * asc(status) puts active first, then paused, then archived, by the pg enum's
 * declaration order.
 *
 * SCOPED TO THE SEARCHER, IN THE WHERE CLAUSE. `app.view` is 'all' for admins,
 * managers and auditors and 'scoped' for the three seats whose reach is a set
 * of projects — an editor's and a member's assignments, a stakeholder's
 * grants. Narrowing has to happen in SQL, not over the rows that come back:
 * LIMIT 6 applied ahead of an authorisation filter hands back a page that has
 * already discarded whatever the searcher was allowed to see, so a client seat
 * typing two characters reads "no results" rather than their own project. That
 * failure looks like an empty index, which is why nobody reports it.
 *
 * `loadActor()` rather than `ctx.user.role` on its own: an employment stage can
 * narrow a seat's grant (capabilities.ts `capFor`), and the scope set is a
 * database read that the session cannot carry. It is react-cached, so every
 * provider in one palette fan-out shares a single resolution rather than
 * buying one each.
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'apps',
    label: 'Apps',
    rank: 10,
    search: async (query, ctx) => {
      // Imported HERE, inside the call, not at module scope. A static import of
      // anything that reaches next-auth kills registry.test.ts at IMPORT time
      // with "Cannot find module 'next/server'" — a crash in the guard that
      // protects this plane, not a type error. The rule and the full story are
      // in features/intel/commands.ts. Node caches the module, so this resolves
      // once per process, not once per keystroke.
      const { loadActor } = await import('@/features/auth/actor')
      const actor = await loadActor()
      if (!actor) return []
      const level = effectiveGrant(actor.role, actor.employmentType, 'app.view')
      if (level === 'none') return []

      const scopeIds = [...actor.scopeAppIds]
      // A scoped seat holding no projects reaches nothing. Answered here so the
      // palette does not spend a Neon round trip per keystroke on a query whose
      // WHERE is already known to be false.
      if (level === 'scoped' && scopeIds.length === 0) return []

      const visible =
        level === 'all'
          ? undefined
          : level === 'scoped'
            ? inArray(liveApps.id, scopeIds)
            // 'own' is unused by today's matrix and written out anyway: a grant
            // row is a table somebody edits, and a provider that fell through
            // to "no filter" on a level it had not considered would be a leak
            // introduced by a one-word change in another file. Running a
            // project is the only ownership an app has.
            : or(eq(liveApps.pmId, ctx.user.id), eq(liveApps.leadId, ctx.user.id))

      const pattern = likePattern(query)
      const rows = await db
        .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug, status: liveApps.status })
        .from(liveApps)
        .where(
          and(
            visible,
            or(
              ilike(liveApps.name, pattern),
              ilike(liveApps.slug, pattern),
              // Tech tags are a text[]; flatten before matching so "next" finds
              // an app tagged next.js without an unnest + group.
              sql`array_to_string(${liveApps.techTags}, ' ') ILIKE ${pattern}`,
            ),
          ),
        )
        .orderBy(asc(liveApps.status), asc(liveApps.name))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((app) => ({
        id: app.id,
        title: app.name,
        subtitle: app.slug,
        href: `/apps/${app.slug}`,
        status: app.status,
        kind: 'app' as const,
      }))
    },
  },
]
