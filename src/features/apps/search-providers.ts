import { asc, or, ilike, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps } from '@/db/live'
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
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'apps',
    label: 'Apps',
    rank: 10,
    search: async (query) => {
      const pattern = likePattern(query)
      const rows = await db
        .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug, status: liveApps.status })
        .from(liveApps)
        .where(
          or(
            ilike(liveApps.name, pattern),
            ilike(liveApps.slug, pattern),
            // Tech tags are a text[]; flatten before matching so "next" finds
            // an app tagged next.js without an unnest + group.
            sql`array_to_string(${liveApps.techTags}, ' ') ILIKE ${pattern}`,
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
