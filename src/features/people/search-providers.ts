import { and, asc, or, ilike } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { canHoldWork } from '@/features/people/removal-queries'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'

/**
 * People in the command center.
 *
 * `canHoldWork()` is not an ordinary predicate to be relaxed: it is the ONLY
 * thing keeping deactivated, pending, rejected and REMOVED accounts out of
 * the palette. `users` has no deletedAt — removal is recorded beside the user
 * in user_deletions instead, for the reason spelled out on that table in
 * src/db/schema.ts, which is why this needs a shared predicate rather than
 * the active+approved pair that used to be written out here.
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
            canHoldWork(),
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
