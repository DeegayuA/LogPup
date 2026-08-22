import { and, eq, exists, or, sql, type SQL } from 'drizzle-orm'

import { db } from '@/db'
import { meetingAttendees } from '@/db/schema'
import { liveMeetings } from '@/db/live'

/**
 * THE one predicate for "may this viewer see this meeting at all".
 *
 * 'workspace' meetings are visible to every signed-in teammate — the
 * pre-visibility behaviour. 'attendees' meetings exist only for the people on
 * them: not in lists, not on calendars, not in ⌘K, not in an AI grounding
 * pack. A quick note is 'attendees' from birth, so a one-click private
 * scratchpad stops appearing on nineteen colleagues' calendars; adding an
 * attendee is what shares it.
 *
 * One EXPORTED predicate rather than a WHERE clause per call site, because
 * visibility.test.ts enforces its use the way live.test.ts enforces the
 * live_* views: every file that reads meetings either calls this (the token
 * it scans for) or states in the allowlist why its read cannot leak. A
 * private meeting that appears in one forgotten query is exactly as leaked
 * as one that appears everywhere.
 *
 * The membership arm reads RAW meeting_attendees on purpose: attendee rows
 * are live iff their meeting is live (MEETING_CHILD_TABLES in src/db/live.ts),
 * and the caller is already joined to liveMeetings.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function meetingVisibleTo(viewerId: string): SQL {
  // A viewer that is not a uuid (an empty session fallback, a test stub)
  // gets the PUBLIC subset, not an exception: comparing '' against a uuid
  // column is a Postgres cast error, which would turn "not signed in enough"
  // into a 500 on every meetings list.
  if (!UUID_RE.test(viewerId)) return eq(liveMeetings.visibility, 'workspace')
  return or(
    eq(liveMeetings.visibility, 'workspace'),
    exists(
      db
        .select({ one: sql`1` })
        .from(meetingAttendees)
        .where(
          and(
            eq(meetingAttendees.meetingId, liveMeetings.id),
            eq(meetingAttendees.userId, viewerId),
          ),
        ),
    ),
  )!
}
