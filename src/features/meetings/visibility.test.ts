import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// The visibility drift guard — live.test.ts's shape, pointed at a different
// leak.
//
// meetings.visibility ('workspace' | 'attendees') is enforced nowhere except
// the read layer: a query that forgets meetingVisibleTo shows a private
// meeting to the whole workspace, and it fails no test, throws nothing, and
// looks exactly like the query working. The soft-delete guard exists because
// that same silence kept resurrecting trashed rows; this file exists so a
// NEW reader of meetings must either scope itself to a viewer or say here,
// in writing, why its read cannot leak.
//
// A file "reads meetings" when it imports liveMeetings from '@/db/live'.
// It passes when it calls meetingVisibleTo( somewhere, or carries an
// allowlist entry whose REASON is the whole value of it.
// ---------------------------------------------------------------------------

const FEATURES_DIR = path.resolve(__dirname, '..')

/**
 * Readers that deliberately do not scope by viewer. Every entry says why its
 * read cannot leak an attendees-only meeting — and "revisit" notes mark the
 * entries that are judgement calls rather than proofs.
 */
const ALLOWLIST: Readonly<Record<string, string>> = {
  // Self-scoped: the rows are joined FROM the viewer's own attendance, so an
  // attendees-only meeting only ever reaches the person sitting in it.
  'intel/context-pack.ts': 'joins from the asker’s own meetingAttendees rows — self-attended only',
  'worklog/entry-evidence.ts': 'self-only evidence pack; meetings joined from the subject’s own attendance',

  // Single-meeting reads behind the meeting gates. canReadMeetingIntel’s
  // attendee arm embeds membership; canManageMeeting reaches a PM by app, but
  // a private meeting’s id is undiscoverable through any list, and managing a
  // meeting on your project is a different claim from it appearing on your
  // calendar.
  'meetings/actions.ts': 'by-id reads inside capability-gated actions (canManageMeeting)',
  'meetings/ai-actions.ts': 'by-id reads behind canReadMeetingIntel, whose attendee arm embeds membership',
  'meetings/assistant-actions.ts': 'by-id reads behind canReadMeetingIntel',
  'meetings/recording-queries.ts': 'by-id reads behind canReadMeetingIntel',
  'meetings/followup-move-actions.ts': 'by-id write path behind canManageMeeting',
  'meetings/rsvp-actions.ts': 'an RSVP is by definition the attendee’s own row',
  'meetings/share-actions.ts': 'by-id reads behind the meeting gates',
  'meetings/text-replace-actions.ts': 'by-id write path behind the meeting gates',
  'meetings/planner-actions.ts': 'reads busy WINDOWS (times, not titles) to propose slots — knowing a colleague is busy is not knowing why',
  'meetings/load-actions.ts': 'organizer-scoped: acts on series the caller organises',

  // Aggregates and self-directed reads.
  'meeting-load/gather.ts': 'series analysis over the organiser’s own meetings',
  'meeting-load/queries.ts': 'invited-hours and series aggregates; the meetings named are the viewer’s own invitations',
  'notifications/notify.ts': 'writes notifications TO attendees — inherently membership-directed',
  'notifications/queries.ts': 'a personal inbox joins meetings the recipient was notified about, i.e. is on',
  'apps/queries.ts': 'aggregate meeting COUNTS per app; no title leaves the query',

  // Judgement calls, marked for revisiting.
  //
  // REVISIT: an attendees-only meeting on a project still surfaces in that
  // project’s activity feed and in sprint suggestions, to project members who
  // are not attendees. Bounded (title/summary, project members only) and
  // arguably coherent — a project meeting is project business — but it is a
  // wider circle than the attendee list. If the product decides otherwise,
  // these two need the predicate and a viewer.
  'apps/activity-queries.ts': 'app-scoped feed; REVISIT — leaks a private project meeting’s title to project members',
  'sprints/suggest-actions.ts': 'app-scoped AI-note read; REVISIT — a private project meeting’s summary can steer suggestions',
  'people/handover-queries.ts': 'a leaver’s open meetings, read for the admin running the handover; the handover IS the disclosure',
  'admin/danger-actions.ts': 'admin-only destruction paths; deleting needs to see everything',
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    if (!/\.(ts|tsx)$/.test(name) || /\.test\./.test(name)) return []
    return [full]
  })
}

const readers = walk(FEATURES_DIR)
  .map((file) => ({ file, rel: path.relative(FEATURES_DIR, file), text: readFileSync(file, 'utf8') }))
  .filter(({ text }) => text.includes('liveMeetings') && text.includes("from '@/db/live'"))
  // The predicate’s own home is not a reader to police.
  .filter(({ rel }) => rel !== 'meetings/visibility.ts')

const offenders = readers.filter(({ text }) => !text.includes('meetingVisibleTo('))

describe('every meetings reader is viewer-scoped or says why not', () => {
  // Mirrors live.test.ts's empty-case handling: it.each([]) fails the file.
  if (offenders.length === 0) {
    it('has no unscoped readers at all', () => {
      expect(offenders).toHaveLength(0)
    })
  } else {
    it.each(offenders.map(({ rel }) => ({ rel })))('$rel', ({ rel }) => {
      if (!(rel in ALLOWLIST)) {
        throw new Error(
          `src/features/${rel} reads liveMeetings without meetingVisibleTo(viewerId). ` +
            `Either scope the query to its viewer (import meetingVisibleTo from ` +
            `'@/features/meetings/visibility') or add the file to ALLOWLIST in ` +
            `src/features/meetings/visibility.test.ts with the reason its read cannot ` +
            `leak an attendees-only meeting.`,
        )
      }
    })
  }
})

describe('allowlist hygiene', () => {
  it.each(Object.keys(ALLOWLIST).map((rel) => ({ rel })))(
    '%s — entry still corresponds to an unscoped reader',
    ({ rel }) => {
      const match = offenders.find((o) => o.rel === rel)
      if (!match) {
        throw new Error(
          `ALLOWLIST entry "${rel}" is stale: the file no longer reads liveMeetings ` +
            `without the predicate (it was deleted, stopped reading meetings, or now ` +
            `calls meetingVisibleTo). Remove the entry — a standing exemption for a ` +
            `thing that no longer exists is waiting to be inherited.`,
        )
      }
    },
  )
})
