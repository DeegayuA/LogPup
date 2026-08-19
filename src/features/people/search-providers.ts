import { and, asc, eq, or, ilike } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'

/**
 * People in the command center.
 *
 * The active + approved pair is not an ordinary predicate to be relaxed: it is
 * the ONLY thing keeping deactivated, pending and rejected accounts out of the
 * palette. `users` has no deletedAt — this is what soft deletion looks like
 * for a person.
 *
 * Email is searched but deliberately not returned. Someone typing a colleague's
 * address should find them; nobody should be able to read the whole address
 * book out of a palette response.
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'people',
    label: 'People',
    rank: 20,
    search: async (query) => {
      const pattern = likePattern(query)
      const rows = await db
        .select({ id: users.id, name: users.name, title: users.title })
        .from(users)
        .where(
          and(
            eq(users.active, true),
            eq(users.status, 'approved'),
            or(
              ilike(users.name, pattern),
              ilike(users.email, pattern),
              ilike(users.title, pattern),
            ),
          ),
        )
        .orderBy(asc(users.name))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((person) => ({
        id: person.id,
        title: person.name,
        subtitle: person.title ?? undefined,
        href: `/people/${person.id}`,
        kind: 'person' as const,
      }))
    },
  },
]
