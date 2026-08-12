/**
 * Splits a meeting list into upcoming (ascending, soonest first) and past
 * (as given — callers pass results already ordered newest-first, which is
 * what the past section wants). Pulled out of the /meetings page component
 * because calling `new Date()` directly in a component body trips the
 * react-hooks/purity lint rule (components must be idempotent); a plain
 * helper function has no such restriction.
 *
 * A meeting is PAST once it has ENDED, not once it has started. Splitting on
 * `startsAt` filed a meeting under "Past" the moment it began — so a session
 * running right now sat in the past list wearing a "Happening now" badge,
 * because that badge is computed from `endsAt` (see meetingTiming, which
 * returns 'live' while `startsAt <= now < endsAt`). Two parts of the same
 * screen contradicting each other about the same meeting. This now uses the
 * same rule meetingTiming does, which is also the only sensible reading of
 * "past".
 */
export function splitByUpcoming<T extends { startsAt: Date; endsAt: Date }>(
  meetings: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const nowMs = now.getTime()
  const hasEnded = (meeting: T) => meeting.endsAt.getTime() <= nowMs

  const upcoming = meetings
    .filter((meeting) => !hasEnded(meeting))
    // Still sorted by START, so a meeting already under way sorts to the top
    // of "upcoming" — which is where the one you are sitting in belongs.
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const past = meetings.filter(hasEnded)
  return { upcoming, past }
}
