'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  getMeetingGlancesChunked,
  type GlanceBatchResult,
} from '@/features/meetings/glance-batch'
import { SOON_MINUTES } from '@/features/meetings/components/meeting-glance'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'

/**
 * The one client-side store for the batched glance response — the triage
 * rail's counts, every row's chip line and the Dossier sheet's panel all read
 * from here, which is what makes it impossible for a tile to say "3 overdue"
 * while the row it filters to says nothing.
 *
 * Deliberately a resolved-in-an-effect promise rather than `use()`+Suspense:
 * the page fires `getMeetingGlances` once WITHOUT awaiting it, so the docket
 * paints from `listMeetings` facts immediately and the whole list fills in a
 * single repaint when the batch lands. Suspending per consumer would trade
 * that one repaint for a waterfall of fallbacks and scatter the error across
 * every tile; this keeps exactly one pending state and one error surface.
 */

export type GlanceMapStatus = 'pending' | 'ready' | 'error'

/** Re-exported so existing consumers keep their import path — the shape now
 *  lives beside the chunking wrapper both sides of the wire share. */
export type { GlanceBatchResult }

export type GlanceMapContextValue = {
  /**
   * Per-meeting tri-state, read as `glances[id]`:
   *   missing (undefined) — the batch has not answered yet → skeleton slot
   *   null                — answered, nothing to show (or not permitted to
   *                         show; the two are indistinguishable BY DESIGN so
   *                         counts never leak) → no chips
   *   MeetingGlance       — counts
   */
  glances: Record<string, MeetingGlance | null>
  status: GlanceMapStatus
  /** Ids a SUPPLEMENTAL batch (requestGlances) is still asking about — rows
   *  for these render the pending skeleton even when `status` is 'ready',
   *  because absence from `glances` already reads as null once the main
   *  batch has answered. */
  pendingIds: ReadonlySet<string>
  /** Re-fires the batch for every id asked for so far (the page's initial
   *  ids plus any requestGlances additions) — the one Retry the list-level
   *  error notice offers. */
  retry: () => void
  /**
   * Asks the batch action about ids that arrived AFTER first paint — "Show
   * earlier meetings" pages and targeted `?day` fetches. Dedupes against
   * everything already requested, merges the answer into the map without
   * disturbing existing entries, and leaves the ids absent on failure so
   * those rows degrade to no chips (the same honest null as today).
   */
  requestGlances: (meetingIds: string[]) => void
  /**
   * Write-through from the Dossier sheet's `MeetingIntelPanel`: every intel
   * (re)load hands its fresh glance here, so a follow-up resolved inside the
   * sheet updates the row chip and the rail tile behind it without a refetch.
   */
  mergeGlance: (meetingId: string, glance: MeetingGlance | null) => void
}

const GlanceMapContext = createContext<GlanceMapContextValue | null>(null)

export function MeetingGlanceProvider({
  glancesPromise,
  meetingIds,
  children,
}: {
  /** The un-awaited `getMeetingGlances(ids)` call the page kicked off — the
   *  page must NOT await it, or the docket waits on the batch to paint. */
  glancesPromise: Promise<GlanceBatchResult>
  /** The ids that promise was invoked with, so `retry` can ask the same
   *  question — a retry over a different id set would be a different answer. */
  meetingIds: string[]
  children: ReactNode
}) {
  const [glances, setGlances] = useState<Record<string, MeetingGlance | null>>({})
  const [status, setStatus] = useState<GlanceMapStatus>('pending')
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set())

  // Monotonic token so a slow first batch cannot overwrite a retry that
  // already answered — only the newest request may write.
  const generation = useRef(0)

  const apply = useCallback((token: number, result: GlanceBatchResult) => {
    if (token !== generation.current) return
    if (result.ok) {
      // MERGE, never replace: a supplemental requestGlances batch may have
      // landed while this one was in flight, and a whole-map write would
      // silently wipe those paged-in entries back to null.
      setGlances((prev) => ({ ...prev, ...result.map }))
      setStatus('ready')
    } else {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    const token = ++generation.current
    // The action's contract is "never throws" — the rejection arm is for the
    // transport itself failing (offline, deploy mid-flight), which must land
    // on the same single error surface rather than an unhandled rejection.
    glancesPromise.then(
      (result) => apply(token, result),
      () => apply(token, { ok: false }),
    )
    // No status reset when the promise prop changes (a router.refresh hands a
    // new one): the map already on screen stays until the new batch answers,
    // so a refresh revalidates in place instead of flashing every chip back
    // to a skeleton.
  }, [glancesPromise, apply])

  // Kept in refs via an effect so `retry`/`requestGlances` can stay
  // referentially stable even when the caller builds the ids array inline
  // each render — a new context value every render would re-render every row
  // for nothing. `supplementalRef` survives a router.refresh handing in a
  // fresh meetingIds prop, so retry keeps covering paged-in rows too.
  const supplementalRef = useRef<string[]>([])
  const idsRef = useRef(meetingIds)
  useEffect(() => {
    idsRef.current = [...new Set([...meetingIds, ...supplementalRef.current])]
  }, [meetingIds])

  const retry = useCallback(() => {
    const token = ++generation.current
    setStatus('pending')
    getMeetingGlancesChunked(idsRef.current).then(
      (result) => apply(token, result),
      () => apply(token, { ok: false }),
    )
  }, [apply])

  /** Resolve one supplemental batch: merge what answered, clear the pending
   *  marks either way. A failure leaves the ids absent — rows degrade to no
   *  chips rather than flipping the whole page's status to 'error' after the
   *  chips already painted. */
  const settleSupplemental = useCallback(
    (ids: string[], map: Record<string, MeetingGlance | null> | null) => {
      if (map) {
        setGlances((prev) => {
          const next = { ...prev }
          for (const id of ids) {
            if (id in map) next[id] = map[id]
          }
          return next
        })
      }
      setPendingIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    },
    [],
  )

  const requestGlances = useCallback(
    (requestedIds: string[]) => {
      const known = new Set(idsRef.current)
      const fresh = [...new Set(requestedIds)].filter((id) => !known.has(id))
      if (fresh.length === 0) return
      // Recorded before the fetch so retry re-asks over these too, and — NO
      // generation bump: a supplemental batch must not race or cancel the
      // main one; apply() merges, so order of arrival cannot lose entries.
      supplementalRef.current = [...supplementalRef.current, ...fresh]
      idsRef.current = [...idsRef.current, ...fresh]
      setPendingIds((prev) => {
        const next = new Set(prev)
        for (const id of fresh) next.add(id)
        return next
      })
      getMeetingGlancesChunked(fresh).then(
        (result) => settleSupplemental(fresh, result.ok ? result.map : null),
        () => settleSupplemental(fresh, null),
      )
    },
    [settleSupplemental],
  )

  const mergeGlance = useCallback((meetingId: string, glance: MeetingGlance | null) => {
    setGlances((prev) => (prev[meetingId] === glance ? prev : { ...prev, [meetingId]: glance }))
  }, [])

  const value = useMemo(
    () => ({ glances, status, pendingIds, retry, requestGlances, mergeGlance }),
    [glances, status, pendingIds, retry, requestGlances, mergeGlance],
  )

  return <GlanceMapContext.Provider value={value}>{children}</GlanceMapContext.Provider>
}

/**
 * Null when no provider is mounted — which is a REAL state, not a bug:
 * `MeetingList` also renders on surfaces that never batch glances (an app
 * page's Meetings tab). Rows there must degrade to no chip slot at all;
 * throwing, or defaulting to a pending map, would strand those rows on an
 * eternal skeleton for data nobody asked for.
 */
export function useGlanceMapOptional(): GlanceMapContextValue | null {
  return useContext(GlanceMapContext)
}

/* --- the boundary-crossing clock --------------------------------------- */

/**
 * The next instant at which any rendered meeting changes timing state — the
 * soonest of `startsAt`, `endsAt`, or the "Starting soon" threshold
 * (`startsAt` minus SOON_MINUTES, the label flip meetingTiming makes) that is
 * strictly after `now`, or null when nothing ahead remains. Pure and exported
 * for its test.
 */
export function nextListBoundary(
  meetings: readonly { startsAt: Date; endsAt: Date }[],
  now: Date,
): Date | null {
  const nowMs = now.getTime()
  let next = Infinity
  for (const meeting of meetings) {
    const start = meeting.startsAt.getTime()
    const soon = start - SOON_MINUTES * 60_000
    const end = meeting.endsAt.getTime()
    if (soon > nowMs && soon < next) next = soon
    if (start > nowMs && start < next) next = start
    if (end > nowMs && end < next) next = end
  }
  return next === Infinity ? null : new Date(next)
}

/** setTimeout clamps its delay to a signed 32-bit int; anything longer would
 *  fire immediately. A boundary further out than this re-arms when it fires. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

/** Fired a beat AFTER the boundary, never before: a timer that lands a few
 *  milliseconds early reads a `now` still on the old side, recomputes the
 *  same boundary, and — its timeout already consumed — never re-arms. */
const BOUNDARY_SLACK_MS = 250

/**
 * One shared `now` for a rendered list, refreshed at exactly the instants a
 * label could change.
 *
 * The timing labels are deliberately day-coarse (see meetingTiming), so a
 * ticking interval would be 3,600 wake-ups an hour to change nothing. What
 * DOES go stale on an open tab is the boundary crossing itself: "Starting
 * soon" after the meeting began, "Happening now" after it ended. This arms
 * one client-only timer — post-mount, so server and client first-paint from
 * the same render-time clock read — for the next `startsAt`/`endsAt` among
 * the rendered meetings, refreshes the single shared `now` there, then
 * re-arms for the boundary after that. A handful of ticks per hour, one
 * clock read per render, every row still measured against the same instant.
 */
export function useListNow(meetings: readonly { startsAt: Date; endsAt: Date }[]): Date {
  const [now, setNow] = useState(() => new Date())

  const boundary = nextListBoundary(meetings, now)
  const boundaryMs = boundary === null ? null : boundary.getTime()
  const nowMs = now.getTime()

  useEffect(() => {
    if (boundaryMs === null) return
    // A negative delay (throttled background tab, machine woken from sleep)
    // clamps to an immediate corrective tick.
    const delay = Math.min(Math.max(boundaryMs - Date.now(), 0) + BOUNDARY_SLACK_MS, MAX_TIMEOUT_MS)
    const timer = setTimeout(() => setNow(new Date()), delay)
    return () => clearTimeout(timer)
    // `nowMs` is a dependency ON PURPOSE: every fire produces a new `now`,
    // which re-runs this effect and arms the FOLLOWING boundary even when
    // two meetings share one (same boundaryMs, new timer needed).
  }, [boundaryMs, nowMs])

  return now
}
