'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { differenceInCalendarDays, format, isSameDay } from 'date-fns'
import { CalendarDays, List } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { HolidayLegend } from '@/components/shared/holiday-icon'
import { UpcomingMeetingsFiltered } from '@/features/meetings/components/upcoming-filter'
import { PastMeetingsSection } from '@/features/meetings/components/past-meetings-section'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { MeetingIntelSheet } from '@/features/meetings/components/meeting-intel-sheet'
import { MeetingsCalendar, useIsWideScreen } from '@/features/meetings/components/meetings-calendar'
import { useGlanceMapOptional, useListNow } from '@/features/meetings/components/use-glance-map'
import {
  calendarUrlPatch,
  isIsoDate,
  isoDayInstant,
  isoToDisplayDate,
  parseCalendarView,
  parseFocusedDate,
  visibleRange,
  type CalendarView,
} from '@/features/meetings/calendar-view'
import { decideIntelReadable } from '@/features/meetings/glance-core'
import {
  fetchMeetingsForDay,
  fetchMeetingsForRange,
  fetchOlderPast,
} from '@/features/meetings/list-actions'
import { filterMeetingsBySearch } from '@/features/meetings/list-search'
import { matchesListFilter, parseListFilter } from '@/features/meetings/list-filter'
import type { UserRole } from '@/features/auth/capabilities'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

const VIEWS = [
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
] as const

const EMPTY_SET: ReadonlySet<string> = new Set()

/** Days the mini-calendar strip renders — kept in sync with upcoming-filter. */
const STRIP_DAYS = 30

/**
 * List/calendar switcher for the meetings page, and — for the list view —
 * the owner of the docket's whole URL grammar:
 * `?view=list&day=YYYY-MM-DD&f=…&open=<id>`.
 *
 * The URL is the state channel (render-time derivation, History API, never
 * the effect form): the triage rail's tiles write `?f=` from a different
 * subtree, the palette and Quick note write `?open=`, and everything meets
 * back here. Day, filter and the client-local search compose HERE, once, so
 * the tiles, the rows and the sheet's Prev/Next order can never disagree
 * about which meetings are showing.
 */
export function MeetingsViews({
  upcoming,
  past,
  pastTotal,
  extraOpenMeeting = null,
  currentUserId,
  isAdmin,
  viewerRole,
  managedAppIds,
  users,
  apps = [],
  initialView,
  initialDate,
  todayIso,
}: {
  upcoming: MeetingSummary[]
  /** The newest PAGE of past meetings — older ones arrive via fetchOlderPast. */
  past: MeetingSummary[]
  /** The true past count, so "Past (N)" never lies about the window. */
  pastTotal: number
  /** A `?open=` meeting that lives outside the loaded window, resolved by the
   *  page via getMeetingSummaryById — the sheet can show it; the docket
   *  deliberately does not grow a row for it. */
  extraOpenMeeting?: MeetingSummary | null
  currentUserId: string
  isAdmin: boolean
  /** The viewer's own role + the app ids they run as PM — the inputs
   *  decideIntelReadable (canReadMeetingIntel's batched twin) needs to
   *  resolve, per opened meeting, whether the sheet may mount the panel. */
  viewerRole: UserRole
  managedAppIds: string[]
  users: MentionUser[]
  /** Apps the row-level edit dialog can move a meeting to, and what the
   *  calendar's "click an empty slot" New meeting form offers. */
  apps?: { id: string; name: string }[]
  /** Parsed from the page's awaited `searchParams`, so the first server paint
   *  is already the view the URL asked for rather than a default that flips
   *  after hydration. */
  initialView: CalendarView
  initialDate: string
  /** Today in Asia/Colombo, read once on the server. Both sides of hydration
   *  need the same answer or "today" lands on two different squares. */
  todayIso: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isWide = useIsWideScreen()
  const glanceMap = useGlanceMapOptional()

  /*
   * All state lives in the URL, written with the History API rather than the
   * router — the same choice the sprint board makes and for the same reason:
   * the page has already fetched every meeting, so routing on each press
   * would re-run the server queries to redraw data the browser is holding.
   * Next keeps `useSearchParams` in sync with native push/replaceState, so
   * this still re-renders.
   *
   * replaceState by default (paging or filter-toggling must not bury where
   * you came from); pushState exactly once, on the FIRST `?open=` — so Back
   * closes the sheet, and stepping Prev/Next inside it stays one entry.
   */
  const patchUrl = useCallback(
    (patch: Record<string, string | null>, mode: 'replace' | 'push' = 'replace') => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      const query = params.toString()
      const url = query ? `${pathname}?${query}` : pathname
      if (mode === 'push') window.history.pushState(null, '', url)
      else window.history.replaceState(null, '', url)
    },
    [pathname, searchParams],
  )

  // The docket's own params, render-derived. A mangled `?day` or `?f`
  // degrades to "no filter", never to an error or an empty page.
  const rawDay = searchParams.get('day')
  const dayIso = rawDay && isIsoDate(rawDay) ? rawDay : undefined
  const filter = parseListFilter(searchParams.get('f'))
  const openParam = searchParams.get('open')

  /* `calendarUrlPatch` always writes `view`, so a missing key can only mean
     "nobody has touched the switcher yet" — in which case the server's parse
     (initialView) is exactly right. A bare `?open=` with NO view implies the
     list: the sheet only mounts there, and the palette/context-pack links
     (frozen producers) write exactly that shape — mirrors page.tsx's
     initialView rule so both sides of hydration agree. */
  const rawView = searchParams.get('view')
  const view =
    rawView === null && openParam ? 'list' : parseCalendarView(rawView ?? initialView)
  // Only read when `view` is a calendar view; the list has no focused date.
  const focusedDate = parseFocusedDate(searchParams.get('date') ?? initialDate, todayIso)

  // Client-local search — deliberately NOT in the URL: keystrokes are not
  // navigation, and a history entry per letter is thrash.
  const [search, setSearch] = useState('')

  /* --- the past window ------------------------------------------------- */

  // Older pages accumulated by "Show earlier meetings". Appended, deduped by
  // id (a meeting trashed between clicks shifts the keyset — dedupe makes the
  // seam harmless), and kept separate from the by-day fetches below so the
  // paging cursor always describes a CONTIGUOUS window.
  const [olderPast, setOlderPast] = useState<MeetingSummary[]>([])
  const [loadingEarlier, setLoadingEarlier] = useState(false)

  // Targeted `?day` fetches, keyed by day — a key existing is what stops the
  // effect below re-asking for a day that answered empty. `null` records a
  // FAILED fetch (transport or { ok: false }) so the empty-day copy can be
  // replaced by an honest error + Retry instead of fake emptiness.
  const [fetchedDays, setFetchedDays] = useState<Record<string, MeetingSummary[] | null>>({})

  const windowPast = (() => {
    const byId = new Map<string, MeetingSummary>()
    for (const meeting of [...past, ...olderPast]) byId.set(meeting.id, meeting)
    return [...byId.values()]
  })()

  const dayFetchResult = dayIso ? fetchedDays[dayIso] : undefined
  const dayExtras = Array.isArray(dayFetchResult) ? dayFetchResult : []
  const dayFetchFailed = dayFetchResult === null

  // One shared clock, refreshed only at the instants a rendered meeting
  // crosses a timing boundary (see useListNow).
  const now = useListNow([...upcoming, ...windowPast, ...dayExtras])

  // The client-side split. queries.ts assigns this side the job: "a meeting
  // that ends between this read and the client's own render is the client's
  // split to re-file" — so BOTH halves are re-derived from the shared clock
  // each render, and a meeting that finishes on a long-open tab moves from
  // Upcoming to Past the instant the boundary timer fires.
  const nowMs = now.getTime()
  const allLoaded = (() => {
    const byId = new Map<string, MeetingSummary>()
    for (const meeting of [...upcoming, ...windowPast, ...dayExtras]) {
      if (!byId.has(meeting.id)) byId.set(meeting.id, meeting)
    }
    return [...byId.values()]
  })()
  // Soonest first — the server's own upcoming order.
  const liveUpcoming = allLoaded
    .filter((meeting) => meeting.endsAt.getTime() > nowMs)
    .sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || (a.id < b.id ? -1 : 1),
    )
  // Everything past-shaped the docket can currently show, newest-ended first.
  const allPast = allLoaded
    .filter((meeting) => meeting.endsAt.getTime() <= nowMs)
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime() || (a.id < b.id ? 1 : -1))

  /* --- filter composition ---------------------------------------------- */

  const selectedDay = dayIso ? isoToDisplayDate(dayIso) : undefined
  const glances = glanceMap?.glances ?? {}
  const glanceStatus = glanceMap?.status ?? 'ready'
  const glanceBackedFilter = filter !== null && filter !== 'waiting'
  // The "Counting…" beat: a deep-linked `?f=overdue|followups|questions`
  // arriving before the batch answers must not flash the filtered-empty
  // state — the list shows layout-matched skeletons until the counts land.
  const countingFilter = glanceBackedFilter && glanceStatus === 'pending'
  // Spec's degrade: a failed batch DISABLES glance-backed filtering (the
  // active tile stays a press-to-clear link) rather than narrowing the
  // docket to nothing on data that never loaded.
  const glanceFilterDisabled = glanceBackedFilter && glanceStatus === 'error'

  function applyFilters(meetings: MeetingSummary[], half: 'upcoming' | 'past'): MeetingSummary[] {
    let result = meetings
    if (selectedDay) result = result.filter((meeting) => isSameDay(meeting.startsAt, selectedDay))
    if (filter && !glanceFilterDisabled) {
      if (countingFilter) {
        result = []
      } else if (filter === 'waiting' && half === 'past') {
        // The tile counts UPCOMING pending RSVPs only — a past meeting the
        // viewer never answered is not "waiting on you" (and its row carries
        // no RSVP control), so the filtered docket matches the tile's number.
        result = []
      } else {
        result = result.filter((meeting) =>
          matchesListFilter(filter, meeting, currentUserId, glances[meeting.id]),
        )
      }
    }
    return filterMeetingsBySearch(result, search)
  }

  const visibleUpcoming = applyFilters(liveUpcoming, 'upcoming')
  const visiblePast = applyFilters(allPast, 'past')

  /* --- targeted by-day fetch ------------------------------------------- */

  // A `?day` the loaded window cannot answer (no rows on it, and the server
  // holds more past than we fetched) triggers ONE targeted fetch — the
  // alternative is a date picker that silently answers nothing for any day
  // older than the newest twenty meetings.
  const dayOnlyCount = selectedDay
    ? [...upcoming, ...windowPast].filter((meeting) => isSameDay(meeting.startsAt, selectedDay))
        .length
    : 0
  const needsDayFetch = Boolean(
    dayIso &&
      dayOnlyCount === 0 &&
      pastTotal > windowPast.length &&
      !(dayIso in fetchedDays),
  )
  const requestGlances = glanceMap?.requestGlances
  useEffect(() => {
    if (!needsDayFetch || !dayIso) return
    let cancelled = false
    fetchMeetingsForDay(dayIso).then(
      (res) => {
        if (cancelled) return
        // A failure records null — a distinguishable state, so "No past
        // meetings on that day" can never mask an error (the past section
        // shows a worded notice with Retry instead). Success also asks the
        // glance store about the new ids, or the fetched rows would render
        // chip-less forever (absence reads as null once the batch is ready).
        setFetchedDays((prev) => ({ ...prev, [dayIso]: res.ok ? res.meetings : null }))
        if (res.ok) requestGlances?.(res.meetings.map((meeting) => meeting.id))
      },
      () => {
        // The action never throws; this arm is the transport itself failing
        // (offline click, deploy mid-flight) — same honest error state.
        if (!cancelled) setFetchedDays((prev) => ({ ...prev, [dayIso]: null }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [needsDayFetch, dayIso, requestGlances])

  /** Forgets a failed day so the effect above re-asks — the Retry the
   *  past section's error notice offers. */
  function retryDayFetch() {
    if (!dayIso) return
    setFetchedDays((prev) => {
      const next = { ...prev }
      delete next[dayIso]
      return next
    })
  }

  function showEarlier() {
    const last = windowPast[windowPast.length - 1]
    if (!last || loadingEarlier) return
    setLoadingEarlier(true)
    fetchOlderPast({ endsAt: last.endsAt.toISOString(), id: last.id })
      .then(
        (res) => {
          if (res.ok) {
            setOlderPast((prev) => [...prev, ...res.meetings])
            // The paged-in rows need glances too — without this they show no
            // chips and can never match an active `?f` filter.
            requestGlances?.(res.meetings.map((meeting) => meeting.id))
          } else {
            toast.error('Could not load earlier meetings — try again')
          }
        },
        // Transport rejection (the action's contract is "never throws").
        () => toast.error('Could not load earlier meetings — try again'),
      )
      .finally(() => setLoadingEarlier(false))
  }

  /* --- calendar range fetch --------------------------------------------- */

  // The calendar views render from props, and the page only loads a windowed
  // past — so stepping month/agenda back past the oldest loaded meeting
  // would silently show empty days where meetings exist. When the visible
  // range reaches older than the contiguous window (and the server holds
  // more), fetch that range ONCE and merge; the cache key is the range, so
  // paging back and forth never refetches ([] is recorded on failure to
  // stop refires — the calendar has no error surface of its own).
  const [fetchedRanges, setFetchedRanges] = useState<Record<string, MeetingSummary[]>>({})

  const calendarRange = view !== 'list' ? visibleRange(view, focusedDate) : null
  const oldestLoadedMs =
    windowPast.length > 0 ? windowPast[windowPast.length - 1].endsAt.getTime() : Infinity
  // Start of the range's first day (isoDayInstant is that day's midday).
  const rangeStartMs = calendarRange
    ? isoDayInstant(calendarRange.start).getTime() - 12 * 60 * 60_000
    : 0
  const rangeKey = calendarRange ? `${calendarRange.start}:${calendarRange.end}` : null
  const needsRangeFetch = Boolean(
    rangeKey &&
      !(rangeKey in fetchedRanges) &&
      pastTotal > windowPast.length &&
      rangeStartMs < oldestLoadedMs,
  )
  useEffect(() => {
    if (!needsRangeFetch || !rangeKey) return
    const [start, end] = rangeKey.split(':')
    let cancelled = false
    fetchMeetingsForRange({ start, end }).then(
      (res) => {
        if (cancelled) return
        setFetchedRanges((prev) => ({ ...prev, [rangeKey]: res.ok ? res.meetings : [] }))
      },
      () => {
        if (!cancelled) setFetchedRanges((prev) => ({ ...prev, [rangeKey]: [] }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [needsRangeFetch, rangeKey])

  // What the calendar's `past` prop carries: the windowed past plus every
  // range-fetched row that is not already loaded elsewhere (upcoming rows
  // would double-render — MeetingsCalendar concatenates both props).
  const calendarPast = (() => {
    if (view === 'list') return windowPast
    const upcomingIds = new Set(upcoming.map((meeting) => meeting.id))
    const byId = new Map<string, MeetingSummary>()
    for (const meeting of windowPast) byId.set(meeting.id, meeting)
    for (const rows of Object.values(fetchedRanges)) {
      for (const meeting of rows) {
        if (!upcomingIds.has(meeting.id) && !byId.has(meeting.id)) byId.set(meeting.id, meeting)
      }
    }
    return [...byId.values()]
  })()

  /* --- the Dossier sheet ------------------------------------------------ */

  // `?open` WINS over a hiding `?f`/`?day`/search: the sheet resolves from
  // the unfiltered lists, so a deep link opens its meeting even when the
  // docket happens to be narrowed past it.
  const openMeeting = openParam
    ? (allLoaded.find((meeting) => meeting.id === openParam) ??
      (extraOpenMeeting?.id === openParam ? extraOpenMeeting : null))
    : null

  // canReadMeetingIntel's rule, decided client-side from facts the server
  // already handed over (the viewer's role, their PM apps, this row's
  // attendees) — decideIntelReadable is the SAME function the glance batch
  // gates with, so the sheet and the chips can never disagree.
  const managedSet = new Set(managedAppIds)
  const canReadIntel = openMeeting
    ? decideIntelReadable({
        viewer: { id: currentUserId, role: viewerRole },
        meeting: { id: openMeeting.id, createdBy: openMeeting.createdBy },
        meetingAppIds: openMeeting.apps.map((app) => app.id),
        managedAppIds: managedSet,
        attendedMeetingIds: openMeeting.attendees.some((a) => a.id === currentUserId)
          ? new Set([openMeeting.id])
          : EMPTY_SET,
      })
    : false

  // Where focus goes back to when the sheet closes. The dialog primitive
  // returns focus to its trigger — but this sheet has none (it is mounted by
  // the URL), so the row button that opened it is remembered here.
  const openTriggerRef = useRef<HTMLElement | null>(null)

  const openMeetingInSheet = useCallback(
    (meeting: MeetingSummary) => {
      openTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      patchUrl({ view: 'list', date: null, open: meeting.id }, openParam ? 'replace' : 'push')
    },
    [patchUrl, openParam],
  )

  function closeSheet() {
    const openedId = openParam
    patchUrl({ open: null })
    const trigger = openTriggerRef.current
    openTriggerRef.current = null
    // After the dialog unmounts — otherwise its own teardown focus
    // handling runs last and strands focus on <body>.
    requestAnimationFrame(() => {
      if (trigger?.isConnected) {
        trigger.focus()
        return
      }
      // The trigger is gone (opened from a calendar surface that unmounted
      // when the view switched to list) — fall back to the opened meeting's
      // own row title button rather than stranding focus on <body>.
      if (openedId) {
        const title = document.getElementById(`meeting-title-${openedId}`)
        const button = title?.closest('button')
        if (button instanceof HTMLElement) button.focus()
      }
    })
  }

  // Prev/Next step through the docket's CURRENT visual order — filtered,
  // searched, upcoming then past. A meeting the filter hides (the
  // open-wins case) has no place in that order, so the pair disables.
  const orderedVisible = [...visibleUpcoming, ...visiblePast]
  const openIndex = openMeeting
    ? orderedVisible.findIndex((meeting) => meeting.id === openMeeting.id)
    : -1
  const stepTo = (meeting: MeetingSummary) => patchUrl({ open: meeting.id })
  const onPrev = openIndex > 0 ? () => stepTo(orderedVisible[openIndex - 1]) : undefined
  const onNext =
    openIndex >= 0 && openIndex < orderedVisible.length - 1
      ? () => stepTo(orderedVisible[openIndex + 1])
      : undefined

  /* --- day strip anchoring ---------------------------------------------- */

  // The strip's 30-day window, lifted here so a JumpToDate pick outside it
  // re-anchors the strip onto the chosen day instead of leaving the roving
  // tab stop pointing at a cell that no longer reflects the filter.
  const [stripStart, setStripStart] = useState(() => new Date())

  function handleDayIsoChange(iso: string | undefined) {
    patchUrl({ view: 'list', date: null, day: iso ?? null })
    if (iso) {
      const picked = isoToDisplayDate(iso)
      const offset = differenceInCalendarDays(picked, stripStart)
      if (offset < 0 || offset >= STRIP_DAYS) setStripStart(picked)
    }
  }

  function clearFilters() {
    patchUrl({ f: null, day: null })
  }

  /**
   * The empty slot somebody clicked in the grid, or `undefined` for "no create
   * dialog open".
   *
   * ONE form for the whole calendar, opened from here — not one per cell. A
   * week view is 7 days × 17 hours of empty slots, and mounting a dialog
   * behind each of them would be ~119 `MeetingForm` instances (each with its
   * own attendee picker and quick-add parser) to serve the one a person might
   * eventually click.
   *
   * The `key` matters: `MeetingForm` seeds its state once per mount, so
   * without it, clicking 3 PM after 2 PM would reopen the dialog still holding
   * 2 PM. Keying on the instant makes each slot a fresh form.
   */
  // start + optional end: the time grid's drag-to-create hands in a full
  // range; the per-slot + button only knows its start.
  const [createAt, setCreateAt] = useState<{ start: Date; end?: Date } | undefined>(undefined)

  /** Week is unusable on a phone, so that is not what "Calendar" opens into
   *  there. This is a DEFAULT, not an override: someone who then picks Week
   *  keeps Week (see the notice in meetings-calendar.tsx). */
  const calendarEntryView: CalendarView = isWide === false ? 'day' : 'week'

  function handleTopLevel(next: (typeof VIEWS)[number]['id']) {
    if (next === 'list') {
      patchUrl(calendarUrlPatch('list', focusedDate))
      return
    }
    // Arriving at the calendar always lands on today: it is opened to answer
    // "what is happening now", and a date left over from a link somebody sent
    // last month is not an answer to that.
    patchUrl(calendarUrlPatch(view === 'list' ? calendarEntryView : view, todayIso))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Meetings view"
          className="flex w-fit items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5"
        >
          {/* Filled variant for the active view — `bg-card` on this `muted/50`
              track resolves to the same color as the track in dark theme, i.e. no
              visible selected state at all. */}
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const active = id === 'list' ? view === 'list' : view !== 'list'
            return (
              <Button
                key={id}
                variant={active ? 'default' : 'ghost'}
                size="sm"
                type="button"
                aria-pressed={active}
                onClick={() => handleTopLevel(id)}
                className="h-7 px-2.5"
              >
                <Icon /> {label}
              </Button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          {/* Both the day strip (list view) and the calendar views mark holidays
              with these icons — one legend covers whichever view is active
              instead of duplicating it per-view. */}
          <HolidayLegend />
        </div>
      </div>

      {view === 'list' ? (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            {/* text-lg semibold — the same level the calendar view's heading
                renders at. The count is here because a section heading with a
                number in it is the cheapest at-a-glance fact on the page. */}
            <h2 className="flex items-baseline gap-2 font-heading text-lg font-semibold">
              Upcoming
              <span className="font-mono text-sm font-normal text-muted-foreground">
                {liveUpcoming.length}
              </span>
            </h2>
            <UpcomingMeetingsFiltered
              meetings={visibleUpcoming}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              users={users}
              apps={apps}
              dayIso={dayIso}
              onDayIsoChange={handleDayIsoChange}
              search={search}
              onSearchChange={setSearch}
              filter={filter}
              counting={countingFilter}
              onClearFilters={clearFilters}
              onOpenMeeting={openMeetingInSheet}
              now={now}
              todayIso={todayIso}
              stripStart={stripStart}
              onStripStartChange={setStripStart}
            />
          </section>
          <PastMeetingsSection
            meetings={visiblePast}
            pastTotal={pastTotal}
            loadedCount={windowPast.length}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            users={users}
            apps={apps}
            dayIso={dayIso}
            onClearDay={() => handleDayIsoChange(undefined)}
            filterActive={filter !== null || search.trim() !== ''}
            counting={countingFilter}
            dayFetchFailed={dayFetchFailed}
            onRetryDayFetch={retryDayFetch}
            onShowEarlier={showEarlier}
            loadingEarlier={loadingEarlier}
            onOpenMeeting={openMeetingInSheet}
            now={now}
            todayIso={todayIso}
          />
        </div>
      ) : (
        <MeetingsCalendar
          view={view}
          focusedDate={focusedDate}
          todayIso={todayIso}
          upcoming={upcoming}
          past={calendarPast}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
          apps={apps}
          openMeetingId={openParam ?? undefined}
          onViewChange={(next) => patchUrl(calendarUrlPatch(next, focusedDate))}
          onFocusedDateChange={(next) => patchUrl(calendarUrlPatch(view, next))}
          onSelectDay={(selected) =>
            patchUrl({ view: 'list', date: null, day: format(selected, 'yyyy-MM-dd') })
          }
          onOpenMeetingInList={openMeetingInSheet}
          onCreateAt={(start, end) => setCreateAt({ start, end })}
        />
      )}

      {/* The Dossier sheet — mounted while `?open=` resolves to a meeting in
          the list view. Rows never mount the intel panel any more; this is
          the one place it exists, so the planner's health pass can run at
          most once per open sheet by construction. */}
      {view === 'list' ? (
        <MeetingIntelSheet
          meeting={openMeeting}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
          apps={apps}
          canReadIntel={canReadIntel}
          now={now}
          onOpenChange={(next) => {
            if (!next) closeSheet()
          }}
          onPrev={onPrev}
          onNext={onNext}
          onGlanceChange={(meetingId, glance) => glanceMap?.mergeGlance(meetingId, glance)}
        />
      ) : null}

      {/* Opened by a `+` on an empty calendar slot. Keyed on the instant so
          each slot mounts a form seeded with its own time (see createAt). */}
      {createAt ? (
        <MeetingForm
          key={createAt.start.toISOString()}
          apps={apps}
          activeUsers={users}
          defaultStart={createAt.start}
          defaultEnd={createAt.end}
          defaultOpen
          onOpenChange={(next) => {
            if (!next) setCreateAt(undefined)
          }}
          trigger={<span className="hidden" />}
        />
      ) : null}
    </div>
  )
}
