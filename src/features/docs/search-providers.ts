import { and, desc, eq, ilike, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveDocs } from '@/db/live'
import { effectiveGrant } from '@/features/auth/capabilities'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'
import { DOC_CATEGORY_LABEL } from '@/features/docs/docs'

/**
 * Docs pages in the command center, matched on TITLE only: a body match
 * would surface every page that mentions a common word, and the hub's own
 * search box already searches bodies inside one project.
 *
 * Gated on `app.view` like tasks and sprints — a page is readable because its
 * project is (the Docs tab asks the same question). Narrowed in the WHERE,
 * never over the returned rows, for the reason sprints/search-providers.ts
 * gives: a LIMIT ahead of an authorisation filter returns the wrong page.
 * Reads liveDocs joined to liveApps, so a trashed page, or a page in a
 * trashed project, is not findable; the tables are named literally so
 * db/live.test.ts can see the read.
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'docs',
    label: 'Docs',
    rank: 45,
    search: async (query) => {
      // Imported inside the call: a module-scope import that reaches
      // next-auth kills registry.test.ts at import time (see
      // features/intel/commands.ts).
      const { loadActor } = await import('@/features/auth/actor')
      const actor = await loadActor()
      if (!actor) return []
      const level = effectiveGrant(actor.role, actor.employmentType, 'app.view')
      if (level === 'none') return []
      // A page has no owner in the app.view sense; 'own' fails closed rather
      // than borrowing the author, as the sprints provider does.
      if (level === 'own') return []
      const appIds = [...actor.scopeAppIds]
      if (level === 'scoped' && appIds.length === 0) return []

      const rows = await db
        .select({
          id: liveDocs.id,
          title: liveDocs.title,
          category: liveDocs.category,
          appName: liveApps.name,
          appSlug: liveApps.slug,
        })
        .from(liveDocs)
        .innerJoin(liveApps, eq(liveApps.id, liveDocs.appId))
        .where(
          and(
            level === 'all' ? undefined : inArray(liveDocs.appId, appIds),
            ilike(liveDocs.title, likePattern(query)),
          ),
        )
        .orderBy(desc(liveDocs.updatedAt))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((doc) => ({
        id: doc.id,
        title: doc.title,
        subtitle: `${doc.appName} · ${DOC_CATEGORY_LABEL[doc.category]}`,
        href: `/apps/${doc.appSlug}?tab=docs&doc=${doc.id}`,
        // 'page' already exists in the persisted recents format, with a
        // document icon (registry/kinds.ts).
        kind: 'page' as const,
      }))
    },
  },
]
