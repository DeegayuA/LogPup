import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { format } from 'date-fns'
import { db } from '@/db'
import { liveApps, liveMeetings } from '@/db/live'
import { meetingVisibleTo } from '@/features/meetings/visibility'
import { meetingApps } from '@/db/schema'
import { formatAppNames } from '@/features/meetings/app-labels'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'

/**
 * Meetings in the command center.
 *
 * Reads liveMeetings, never the base `meetings` table — a trashed meeting must
 * stop being findable. A raw read here would resurface a meeting in ⌘K while
 * admin Trash still lists it deleted, and it turns src/db/live.test.ts red.
 *
 * The tables are named LITERALLY in the query below and must stay that way.
 * Hoisting them into a config object and selecting from a variable makes
 * live.test.ts's source scan match nothing: it would report no offenders and
 * PASS while the read it exists to catch sat unguarded.
 *
 * A meeting can be on several projects, so the project names are collected by
 * a CORRELATED string_agg rather than a join. A plain join returns one row per
 * meeting-project pair, which would make `.limit(PALETTE_RESULT_LIMIT)` mean
 * "six meeting-project pairs" — one meeting on five projects would eat the
 * whole group and hide five other matches. The aggregate is ORDERED BY APP
 * NAME, not by join-row id, so the two names that survive the "+N" overflow
 * are the same on two searches of the same unchanged meeting.
 *
 * Every hit links to the /meetings list — there is no /meetings/[id] route —
 * but carries `?open=<id>`, which the page parses (see meetings/page.tsx) to
 * land with that meeting's write-up already open and the Past section already
 * expanded. A bare '/meetings' href delivered people to a list with the
 * meeting they searched for still collapsed somewhere down the page.
 */

// Unit separator: a delimiter no project name can contain, so splitting the
// aggregate back apart cannot cut a name in half. A comma would.
const NAME_SEPARATOR = '\u001f'

export const searchProviders: SearchProvider[] = [
  {
    id: 'meetings',
    label: 'Meetings',
    rank: 50,
    search: async (query, ctx) => {
      const pattern = likePattern(query)
      // JOIN + GROUP BY, not a correlated subquery — and that is not a style
      // choice. Drizzle drops table qualifiers from the whole select list when
      // the outer query is SINGLE-TABLE, interpolated columns included. As a
      // subquery off a bare `.from(liveMeetings)` this rendered
      // `where "meeting_id" = "id"`, where "id" bound to the INNER apps.id —
      // a meeting uuid compared to an app uuid, true for no row ever. It threw
      // nothing (no name is ambiguous across the two tables), string_agg over
      // zero rows returned NULL, and every meeting in ⌘K silently fell back to
      // its date. No test could catch it: none of them touch a database.
      // The joins put `isSingleTable` false, which is what restores
      // qualification; GROUP BY keeps LIMIT meaning six MEETINGS rather than
      // six meeting-project pairs.
      const rows = await db
        .select({
          id: liveMeetings.id,
          title: liveMeetings.title,
          startsAt: liveMeetings.startsAt,
          appNames: sql<
            string | null
          >`string_agg(${liveApps.name}, ${NAME_SEPARATOR} order by ${liveApps.name})`,
        })
        .from(liveMeetings)
        .leftJoin(meetingApps, eq(meetingApps.meetingId, liveMeetings.id))
        .leftJoin(liveApps, eq(liveApps.id, meetingApps.appId))
        .where(
          and(
            // An attendees-only meeting is not findable by people who are not
            // on it — an index anyone can type into is exactly where a
            // private title leaks first.
            meetingVisibleTo(ctx.user.id),
            or(ilike(liveMeetings.title, pattern), ilike(liveMeetings.agenda, pattern)),
          ),
        )
        .groupBy(liveMeetings.id, liveMeetings.title, liveMeetings.startsAt)
        .orderBy(desc(liveMeetings.startsAt))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((meeting) => {
        const names = meeting.appNames ? meeting.appNames.split(NAME_SEPARATOR) : []
        return {
          id: meeting.id,
          title: meeting.title,
          // Up to two project names then "+N" ("Alpha, Beta +2"). Still a plain
          // string, so neither the SearchResult type nor registry.test.ts moves.
          //
          // The date fallback stays: it is the next most useful thing to tell
          // apart two meetings called "Weekly sync" when neither belongs to a
          // project, and it is the only thing separating those two rows.
          subtitle: names.length > 0 ? formatAppNames(names) : format(meeting.startsAt, 'MMM d'),
          href: `/meetings?open=${meeting.id}`,
          kind: 'meeting' as const,
        }
      })
    },
  },
]
