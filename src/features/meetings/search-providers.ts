import { desc, eq, ilike, or } from 'drizzle-orm'
import { format } from 'date-fns'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { apps } from '@/db/schema'
import { PALETTE_RESULT_LIMIT, likePattern } from '@/features/search/registry/limits'
import type { SearchProvider } from '@/features/search/registry/types'

/**
 * Meetings in the command center.
 *
 * Reads liveMeetings, never the base table — a trashed meeting must stop
 * being findable. The join to `apps` is a LEFT join because meetings.appId is
 * nullable: a standup belongs to a project, a company all-hands belongs to
 * nobody, and an inner join would hide the second kind entirely.
 *
 * Every hit links to the /meetings list rather than a detail page, because
 * there is no /meetings/[id] route to link to.
 */
export const searchProviders: SearchProvider[] = [
  {
    id: 'meetings',
    label: 'Meetings',
    rank: 50,
    search: async (query) => {
      const pattern = likePattern(query)
      const rows = await db
        .select({
          id: liveMeetings.id,
          title: liveMeetings.title,
          startsAt: liveMeetings.startsAt,
          appName: apps.name,
        })
        .from(liveMeetings)
        .leftJoin(apps, eq(liveMeetings.appId, apps.id))
        .where(or(ilike(liveMeetings.title, pattern), ilike(liveMeetings.agenda, pattern)))
        .orderBy(desc(liveMeetings.startsAt))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        // A date is the next most useful thing to tell apart two meetings
        // called "Weekly sync" when neither belongs to an app.
        subtitle: meeting.appName ?? format(meeting.startsAt, 'MMM d'),
        href: '/meetings',
        kind: 'meeting' as const,
      }))
    },
  },
]
