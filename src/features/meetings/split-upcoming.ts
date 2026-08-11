/**
 * Splits a meeting list into upcoming (ascending, soonest first) and past
 * (as given — callers pass results already ordered newest-first, which is
 * what the past section wants). Pulled out of the /meetings page component
 * because calling `new Date()` directly in a component body trips the
 * react-hooks/purity lint rule (components must be idempotent); a plain
 * helper function has no such restriction.
 */
export function splitByUpcoming<T extends { startsAt: Date }>(
  meetings: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const nowMs = now.getTime()
  const upcoming = meetings
    .filter((m) => m.startsAt.getTime() >= nowMs)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const past = meetings.filter((m) => m.startsAt.getTime() < nowMs)
  return { upcoming, past }
}
