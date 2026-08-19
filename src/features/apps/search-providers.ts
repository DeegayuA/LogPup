import { asc, or, ilike, sql } from 'drizzle-orm'
import { db } from '@/db'
import { apps } from '@/db/schema'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'

/**
 * Apps in the command center.
 *
 * `apps` is read as a base table, not through a live_* subquery, because it
 * has no deletedAt column — an app is retired by moving it to `archived`,
 * which stays findable on purpose (asc(status) puts active first, then
 * paused, then archived, via the pg enum's declaration order).
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'apps',
    label: 'Apps',
    rank: 10,
    search: async (query) => {
      const pattern = likePattern(query)
      const rows = await db
        .select({ id: apps.id, name: apps.name, slug: apps.slug, status: apps.status })
        .from(apps)
        .where(
          or(
            ilike(apps.name, pattern),
            ilike(apps.slug, pattern),
            // Tech tags are a text[]; flatten before matching so "next" finds
            // an app tagged next.js without an unnest + group.
            sql`array_to_string(${apps.techTags}, ' ') ILIKE ${pattern}`,
          ),
        )
        .orderBy(asc(apps.status), asc(apps.name))
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
