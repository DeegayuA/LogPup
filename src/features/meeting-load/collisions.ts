/**
 * Hours somebody was invited to be in two places at once.
 *
 * TEAM TOTAL ON EVERY ORG SURFACE, per-user only in somebody's view of
 * themselves. At nine people a named collision list is a list of who
 * double-books whom, and the aggregate is the interesting number anyway: it is
 * a property of the calendar, not of a person.
 *
 * Pure, and it trusts its input twice over: the caller has already excluded
 * declined attendees, and this module is never given a `response` field to
 * re-check. Filtering in two places is how two surfaces end up with two totals.
 */

/** Under ten minutes between two meetings is not a gap, it is a corridor. */
export const BACK_TO_BACK_GAP_MS = 10 * 60 * 1000

const HOUR_MS = 60 * 60 * 1000

export interface WeekMeetingInterval {
  meetingId: string
  startsAt: Date
  endsAt: Date
  /** Already filtered by the caller. */
  nonDeclinedUserIds: string[]
}

export interface CollisionResult {
  teamOverlapHours: number
  teamBackToBackCount: number
  /** SELF-VIEW ONLY. The caller reads its own session user's key and nothing
   *  else; it exists because "you personally lost 3 hours to double-bookings"
   *  is a fact somebody can act on about their own week. */
  perUserOverlapHours: Record<string, number>
}

export function computeCollisions(weekMeetings: WeekMeetingInterval[]): CollisionResult {
  // A meeting that ends before it starts is a broken row, not a zero-length
  // one: it would produce a negative overlap and make a total shrink.
  const valid = weekMeetings.filter((m) => m.endsAt.getTime() > m.startsAt.getTime())

  const byUser = new Map<string, WeekMeetingInterval[]>()
  for (const meeting of valid) {
    for (const userId of new Set(meeting.nonDeclinedUserIds)) {
      byUser.set(userId, [...(byUser.get(userId) ?? []), meeting])
    }
  }

  let teamOverlapHours = 0
  let teamBackToBackCount = 0
  const perUserOverlapHours: Record<string, number> = {}

  for (const [userId, meetings] of byUser) {
    // `a.meetingId < b.meetingId` rather than index order: it compares each
    // pair exactly once and never a meeting with itself, and it does so
    // independently of how the rows arrived.
    for (const a of meetings) {
      for (const b of meetings) {
        if (!(a.meetingId < b.meetingId)) continue

        const aStart = a.startsAt.getTime(); const aEnd = a.endsAt.getTime()
        const bStart = b.startsAt.getTime(); const bEnd = b.endsAt.getTime()

        // Strict on both sides, so touching intervals (a ends exactly as b
        // starts) are NOT an overlap — that is a back-to-back, counted below.
        if (aStart < bEnd && bStart < aEnd) {
          const hours = (Math.min(aEnd, bEnd) - Math.max(aStart, bStart)) / HOUR_MS
          teamOverlapHours += hours
          perUserOverlapHours[userId] = (perUserOverlapHours[userId] ?? 0) + hours
          continue
        }

        const gap = aStart >= bEnd ? aStart - bEnd : bStart - aEnd
        if (gap < BACK_TO_BACK_GAP_MS) teamBackToBackCount += 1
      }
    }
  }

  return { teamOverlapHours, teamBackToBackCount, perUserOverlapHours }
}
