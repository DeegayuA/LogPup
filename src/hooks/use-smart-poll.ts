'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { nextPollDelay, shouldPoll, type PollSchedule } from '@/lib/poll-schedule'

export type SmartPollOptions<T> = PollSchedule & {
  /** Turn polling off entirely without unmounting the caller. */
  enabled?: boolean
  /**
   * Whether a result counts as "new". Used both to decide what to hand back to
   * the caller and to reset the backoff — so it must compare what the caller
   * actually cares about, not object identity (every server-action response is
   * a fresh object and would always look changed).
   */
  isEqual?: (a: T, b: T) => boolean
}

/**
 * SMART POLLING — adaptive, and asleep whenever nobody is watching.
 *
 * `setInterval(fetch, 5000)` is the shape this exists to avoid: it fires at
 * the same rate on a busy morning and on an idle Sunday, it keeps firing on a
 * backgrounded tab, and it stacks a second request on top of the first when
 * the network is slow. All three cost the server and the user's battery for
 * nothing.
 *
 * What this does instead:
 *
 * - **Backs off when nothing is happening.** Every poll that returns the same
 *   value multiplies the wait up to `maxMs`; the first one that returns
 *   something new snaps straight back to `baseMs` (see lib/poll-schedule.ts).
 *   An idle tab drifts from seconds to minutes on its own.
 * - **Stops dead on a hidden tab, and on a dropped connection.** Nothing is
 *   scheduled at all while `document.hidden` or `!navigator.onLine`.
 * - **Catches up the instant it can.** Coming back to the tab, or coming back
 *   online, polls once immediately at `baseMs` rather than waiting out a timer
 *   that was set before the pause — which is the moment a stale badge is most
 *   obvious.
 * - **Never overlaps.** One in-flight poll at a time; the next is scheduled
 *   from when the last one *finished*, so a slow response cannot pile up a
 *   queue behind it.
 *
 * A failed poll is treated as "nothing changed": it backs off rather than
 * retrying hard, so a server having a bad minute is not handed a retry storm.
 */
export function useSmartPoll<T>(
  fetcher: () => Promise<T>,
  initial: T,
  { baseMs, maxMs, factor = 2, enabled = true, isEqual = Object.is }: SmartPollOptions<T>,
): T {
  const [value, setValue] = useState(initial)

  // Everything the polling loop reads lives in refs: the loop is set up once
  // per `enabled` change, and re-creating it whenever the caller passes a new
  // inline `fetcher` (they all do) would restart the backoff on every render.
  const fetcherRef = useRef(fetcher)
  const isEqualRef = useRef(isEqual)
  const valueRef = useRef(initial)
  useEffect(() => {
    fetcherRef.current = fetcher
    isEqualRef.current = isEqual
    // What the loop compares the next response against, kept level with what
    // is actually rendered — including after the render-time adoption below.
    valueRef.current = value
  })

  // The server sent a fresh `initial` — a navigation, or an action's response.
  // Adopt it so the next poll compares against what is on screen rather than
  // against a snapshot the page has already moved past.
  //
  // Adjusted during render rather than in an effect: React re-runs this
  // component immediately with the new value and never commits the stale one,
  // so there is no frame showing the old snapshot and no cascading render (see
  // https://react.dev/learn/you-might-not-need-an-effect — "adjusting state
  // when a prop changes"). Plain state rather than a ref, because refs must
  // not be touched during render.
  const [seenInitial, setSeenInitial] = useState(initial)
  if (!Object.is(seenInitial, initial)) {
    setSeenInitial(initial)
    setValue(initial)
  }

  const delayRef = useRef(baseMs)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const stoppedRef = useRef(false)

  const conditionsMet = useCallback(
    () =>
      shouldPoll({
        enabled,
        // `document`/`navigator` are read at call time, not at setup time, so
        // the answer reflects the tab's state right now.
        visible: typeof document === 'undefined' || !document.hidden,
        online: typeof navigator === 'undefined' || navigator.onLine !== false,
      }),
    [enabled],
  )

  useEffect(() => {
    stoppedRef.current = false

    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    function schedule(delayMs: number) {
      clearTimer()
      if (stoppedRef.current || !conditionsMet()) return
      timerRef.current = setTimeout(poll, delayMs)
    }

    async function poll() {
      timerRef.current = null
      // Re-check at fire time: the tab may have been hidden since this timer
      // was set, and a request nobody will see is a request not worth making.
      if (stoppedRef.current || inFlightRef.current || !conditionsMet()) return

      inFlightRef.current = true
      let changed = false
      try {
        const next = await fetcherRef.current()
        if (stoppedRef.current) return
        changed = !isEqualRef.current(valueRef.current, next)
        if (changed) {
          valueRef.current = next
          setValue(next)
        }
      } catch {
        // Deliberately silent, and deliberately treated as unchanged: a poll
        // is background upkeep, and a failed one must back off rather than
        // turn a struggling server into a retry storm. The value on screen
        // stays whatever the last good read produced.
        changed = false
      } finally {
        inFlightRef.current = false
      }

      if (stoppedRef.current) return
      delayRef.current = nextPollDelay(delayRef.current, changed, { baseMs, maxMs, factor })
      schedule(delayRef.current)
    }

    /** Back from a hidden tab / a dropped connection: catch up now, fast. */
    function resume() {
      if (!conditionsMet()) {
        clearTimer()
        return
      }
      delayRef.current = baseMs
      clearTimer()
      void poll()
    }

    function handleVisibility() {
      if (document.hidden) {
        clearTimer()
        return
      }
      resume()
    }

    if (conditionsMet()) schedule(delayRef.current)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', resume)
    window.addEventListener('offline', clearTimer)

    return () => {
      stoppedRef.current = true
      clearTimer()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', resume)
      window.removeEventListener('offline', clearTimer)
    }
  }, [baseMs, maxMs, factor, conditionsMet])

  return value
}
