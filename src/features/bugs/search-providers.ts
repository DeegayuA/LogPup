import { and, asc, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveBugReports } from '@/db/live'
import { effectiveGrant } from '@/features/auth/capabilities'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'
import { bugSeverityLabel, bugStatusLabel } from '@/features/bugs/bug-display'

/**
 * Bugs in the command center.
 *
 * Reads `liveBugReports` and joins `liveApps`, never either base table: a
 * trashed bug — or a live bug on a trashed project — that stays findable in
 * ⌘K is one the admin Trash says is gone. The tables are named LITERALLY
 * below and must stay that way; hoisting them into a config object makes
 * db/live.test.ts's source scan match nothing, report no offenders and PASS
 * while the read it exists to guard sits unchecked.
 *
 * OPEN ONES ARE NOT FILTERED OUT. Searching for a bug by name is usually
 * someone asking "did we ever fix that?", and a provider that can only find
 * unfinished work answers that question wrong. `asc(status)` puts open first,
 * then triaged, in progress, resolved and closed, by the pg enum's
 * declaration order — the same property apps/search-providers.ts leans on to
 * float active projects.
 *
 * A hit links to the project's Bugs tab: there is no /bugs/[id] route, and a
 * bug is only ever read next to its project's other bugs.
 *
 * SCOPED TO THE SEARCHER, IN THE WHERE CLAUSE. `bug.view` is 'none' for a
 * stakeholder — a client seat has no business reading the studio's defect list
 * — and 'scoped' for an editor and a member, whose reach is their assigned
 * projects. The refusal is answered before any query runs, and the scoped case
 * narrows in SQL rather than over the returned rows: LIMIT 6 ahead of an
 * authorisation filter returns a page that has already thrown away the rows the
 * searcher could see, which reads as an empty index rather than as a bug.
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'bugs',
    label: 'Bugs',
    rank: 60,
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
      const level = effectiveGrant(actor.role, actor.employmentType, 'bug.view')
      if (level === 'none') return []

      const scopeIds = [...actor.scopeAppIds]
      // A scoped seat holding no projects reaches nothing — no round trip for a
      // WHERE already known to be false.
      if (level === 'scoped' && scopeIds.length === 0) return []

      const visible =
        level === 'all'
          ? undefined
          : level === 'scoped'
            ? inArray(liveBugReports.appId, scopeIds)
            // 'own' is unused by today's matrix and written out anyway, so a
            // one-word change to the grant row cannot silently fall through to
            // "no filter". Both columns count: you own the break you reported
            // and the one somebody handed you to fix.
            : or(
                eq(liveBugReports.reportedBy, ctx.user.id),
                eq(liveBugReports.assignedTo, ctx.user.id),
              )

      const pattern = likePattern(query)
      const rows = await db
        .select({
          id: liveBugReports.id,
          title: liveBugReports.title,
          status: liveBugReports.status,
          severity: liveBugReports.severity,
          appName: liveApps.name,
          appSlug: liveApps.slug,
        })
        .from(liveBugReports)
        .innerJoin(liveApps, eq(liveApps.id, liveBugReports.appId))
        .where(
          and(
            visible,
            or(ilike(liveBugReports.title, pattern), ilike(liveBugReports.description, pattern)),
          ),
        )
        .orderBy(asc(liveBugReports.status), desc(liveBugReports.severity), desc(liveBugReports.createdAt))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((bug) => ({
        id: bug.id,
        title: bug.title,
        // "LogPup · Critical · Open" — the project first, because that is what
        // tells two similarly-worded reports apart, then the two facts a
        // person searching for a bug actually wants before they click.
        subtitle: `${bug.appName} · ${bugSeverityLabel(bug.severity)} · ${bugStatusLabel(bug.status)}`,
        href: `/apps/${bug.appSlug}?tab=bugs`,
        status: bug.status,
        // The recents format (PaletteRecent['type'] in registry/types.ts) is
        // persisted in localStorage under logpup.recents.v1 and has no 'bug'
        // member. A bug is a piece of work, so it wears the task icon rather
        // than widening a stored format from here — that is a change to the
        // registry's own types and the migration of everyone's recents with
        // it, not something a new provider should do on its way past.
        kind: 'task' as const,
      }))
    },
  },
]
