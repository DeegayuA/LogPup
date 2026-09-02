'use server'

// The docket's two follow-on reads, as session-resolved server actions:
// "Show earlier meetings" (cursor-paged past) and the targeted by-day fetch
// an out-of-window `?day` triggers. Thin on purpose — each one is auth plus
// input validation around a query in queries.ts, so the visibility rules
// live in exactly one place and no viewerless read can exist (the viewer is
// ALWAYS the session's, never a parameter a client could choose).

import { z } from 'zod'
import { auth } from '@/lib/auth'
import {
  getMeetingsForDay,
  getMeetingsForRange,
  listMeetingsWindowed,
  type MeetingSummary,
  type PastMeetingCursor,
} from '@/features/meetings/queries'

// endsAt is the ISO instant the client read off the last row it has
// (Date.toISOString), id the uuid tiebreak — see PastMeetingCursor.
const cursorInput = z.object({ endsAt: z.iso.datetime(), id: z.uuid() })

// A calendar day, not a datetime: the Colombo wall-clock interpretation
// happens inside getMeetingsForDay, which double-checks it names a real day.
const dayInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * The next page of past meetings, older than the cursor. { ok: false } for
 * anything that goes wrong — the list swaps ghost rows back to a worded
 * retry, and an error here must never take the loaded docket down.
 */
export async function fetchOlderPast(
  cursor: PastMeetingCursor,
): Promise<{ ok: true; meetings: MeetingSummary[] } | { ok: false }> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false }
    const parsed = cursorInput.safeParse(cursor)
    if (!parsed.success) return { ok: false }

    // The windowed read also refreshes upcoming + the count; only the page
    // is returned. Deliberate: one exported query with one visibility story
    // beats a second past-only variant, and "Show earlier" is a rare, human-
    // paced click, not a hot path.
    const { past } = await listMeetingsWindowed(session.user.id, { pastCursor: parsed.data })
    return { ok: true, meetings: past }
  } catch (error) {
    console.error('[meetings-list] fetchOlderPast failed:', error)
    return { ok: false }
  }
}

/**
 * Every meeting on one Asia/Colombo calendar day, for a `?day` outside the
 * loaded window — so a date jumped to from the picker shows its meetings
 * instead of silently showing nothing.
 */
export async function fetchMeetingsForDay(
  day: string,
): Promise<{ ok: true; meetings: MeetingSummary[] } | { ok: false }> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false }
    const parsed = dayInput.safeParse(day)
    if (!parsed.success) return { ok: false }

    const meetings = await getMeetingsForDay(session.user.id, parsed.data)
    return { ok: true, meetings }
  } catch (error) {
    console.error('[meetings-list] fetchMeetingsForDay failed:', error)
    return { ok: false }
  }
}

// Two calendar days, inclusive — the Colombo wall-clock interpretation and
// the range-size/ordering guards live inside getMeetingsForRange.
const rangeInput = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * Every meeting starting within one span of Asia/Colombo calendar days — the
 * calendar views' fallback when month/agenda navigation steps back past the
 * docket's windowed past, so an old month shows its meetings instead of
 * silently rendering empty.
 */
export async function fetchMeetingsForRange(range: {
  start: string
  end: string
}): Promise<{ ok: true; meetings: MeetingSummary[] } | { ok: false }> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false }
    const parsed = rangeInput.safeParse(range)
    if (!parsed.success) return { ok: false }

    const meetings = await getMeetingsForRange(session.user.id, parsed.data.start, parsed.data.end)
    return { ok: true, meetings }
  } catch (error) {
    console.error('[meetings-list] fetchMeetingsForRange failed:', error)
    return { ok: false }
  }
}
