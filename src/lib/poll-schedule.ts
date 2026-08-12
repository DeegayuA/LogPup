/**
 * SMART POLLING — the arithmetic, with no timers and no DOM in it.
 *
 * A fixed `setInterval` is the wrong shape for a workspace app. LogPup's
 * notification bell is the case in point: a five-second interval is ~17k
 * requests per person per working day, almost all of them answering "still
 * nothing", and it keeps firing on the tab someone left open on Friday
 * afternoon and came back to on Monday.
 *
 * Two independent ideas, kept separate so each can be tested on its own and
 * reasoned about without the other:
 *
 * - {@link nextPollDelay} — back off while nothing is changing, snap back to
 *   the fast cadence the moment something does.
 * - {@link shouldPoll} — do not poll at all when nobody can see the result, or
 *   when there is no network to poll over.
 *
 * Both are pure. The hook in hooks/use-smart-poll.ts is the only part that
 * touches `setTimeout`, `document.visibilityState` or `navigator.onLine`.
 */

export type PollSchedule = {
  /** Fast cadence, used while things are actively changing. */
  baseMs: number
  /** Ceiling for the backoff — never wait longer than this between polls. */
  maxMs: number
  /** Growth per unchanged poll. 2 doubles; 1 disables backoff entirely. */
  factor?: number
}

/**
 * The wait before the next poll.
 *
 * A poll that returned something new means the data is live right now, so the
 * next one goes back to `baseMs` — a burst of activity is exactly when a slow
 * cadence is most annoying. A poll that returned nothing new multiplies the
 * wait, capped at `maxMs`, so an idle tab settles into a trickle instead of
 * hammering on forever.
 */
export function nextPollDelay(
  currentMs: number,
  changed: boolean,
  { baseMs, maxMs, factor = 2 }: PollSchedule,
): number {
  if (changed) return baseMs
  // `Math.max(currentMs, baseMs)` so a caller that hands back a sub-base delay
  // (or the very first call, before any poll has run) still grows from the
  // floor rather than from something smaller.
  const grown = Math.max(currentMs, baseMs) * Math.max(factor, 1)
  return Math.min(grown, maxMs)
}

export type PollConditions = {
  /** Caller-level switch — a signed-out user, a closed panel, a test. */
  enabled: boolean
  /** False when the tab is backgrounded or the window is hidden. */
  visible: boolean
  /** `navigator.onLine`. */
  online: boolean
}

/**
 * Whether a poll should happen at all.
 *
 * Polling a hidden tab spends someone's battery and data plan to update pixels
 * nobody is looking at, and polling while offline is a guaranteed failed
 * request. Neither needs a retry policy — it needs to not happen. The hook
 * polls once immediately when either condition flips back to true, so nothing
 * is lost by having stopped.
 */
export function shouldPoll({ enabled, visible, online }: PollConditions): boolean {
  return enabled && visible && online
}
