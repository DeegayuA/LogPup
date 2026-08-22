import { and, asc, eq, or, ilike, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { assignments, users } from '@/db/schema'
import { effectiveGrant } from '@/features/auth/capabilities'
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
 *
 * AND THE ADDRESS BOOK IS NOT FOR EVERY SEAT. `user.view.directory` is 'none'
 * for a stakeholder, which is the whole point of that row: a client seat must
 * not be able to enumerate the studio's staff two characters at a time. That
 * refusal is answered without touching the database, and the two narrower
 * levels are answered in the WHERE — a LIMIT applied ahead of an authorisation
 * filter returns a page whose visible rows have already been discarded, which
 * presents as an empty directory rather than as a bug.
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'people',
    label: 'People',
    rank: 20,
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
      const level = effectiveGrant(actor.role, actor.employmentType, 'user.view.directory')
      if (level === 'none') return []

      const scopeIds = [...actor.scopeAppIds]

      const visible =
        level === 'all'
          ? undefined
          : level === 'scoped'
            // Colleagues on the projects this seat reaches, plus themselves —
            // `can()` grants a scoped action over your own row too, so leaving
            // yourself out would make you the one person you could not find.
            // The subquery is uncorrelated on purpose: it narrows `users` by a
            // set of ids Postgres builds once, rather than per candidate row.
            ? or(
                eq(users.id, ctx.user.id),
                inArray(
                  users.id,
                  db
                    .select({ userId: assignments.userId })
                    .from(assignments)
                    .where(inArray(assignments.appId, scopeIds)),
                ),
              )
            // 'own' is unused by today's matrix and written out anyway, so a
            // one-word change to the grant row cannot silently fall through to
            // "no filter". The only person you own is you.
            : eq(users.id, ctx.user.id)

      const pattern = likePattern(query)
      const rows = await db
        .select({ id: users.id, name: users.name, title: users.title })
        .from(users)
        .where(
          and(
            canHoldWork(),
            visible,
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
