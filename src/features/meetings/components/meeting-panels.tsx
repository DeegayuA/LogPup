'use client'

// The panelled, filterable, tag-coded shell around the meeting write-up — see
// docs/superpowers/specs/2026-08-12-meeting-writeup-panels-design.md. This
// file owns the interactive machinery (persisted collapse, filters, density,
// the summary language toggle); meeting-notes.tsx, meeting-prep.tsx and
// meeting-intel.tsx supply the content that goes inside a <Panel>.

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react'
import {
  BookOpen,
  ChevronDown,
  ListChecks,
  MessageCircleQuestion,
  Repeat2,
  Rows2Icon,
  Rows4Icon,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CONTENT_KINDS,
  DENSITY_STORAGE_KEY,
  DEFAULT_SUMMARY_LANGUAGE,
  NO_FILTERS,
  PANEL_STORAGE_PREFIX,
  SUMMARY_LANGUAGE_STORAGE_KEY,
  clearFilters as clearFiltersModel,
  hasActiveFilters,
  matchesFilters,
  resolveDensity,
  resolvePanelOpen,
  resolveSummaryLanguage,
  toggleKind,
  type ActiveFilters,
  type ContentKind,
  type Density,
  type FilterableItem,
  type PersonFilterOption,
  type SummaryLanguage,
} from '@/features/meetings/components/meeting-panels-model'

/** Icon + label for each content kind — the identity a Panel wears in its
 *  header. Carried-forward has no `tagAccent`: its colour is entirely
 *  state-driven (fresh/aging/stale, already built) — see the spec's
 *  "Colour + tag system" for why stacking a second colour on it would be
 *  redundant rather than clarifying. */
export const KIND_META: Record<
  ContentKind,
  { label: string; icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; tagAccent?: string }
> = {
  action: { label: 'Action items', icon: ListChecks, tagAccent: 'action' },
  discussion: { label: 'Discussion', icon: Users, tagAccent: 'discussion' },
  question: { label: 'For next meeting', icon: MessageCircleQuestion, tagAccent: 'question' },
  term: { label: 'Glossary', icon: BookOpen, tagAccent: 'term' },
  'carried-forward': { label: 'Carried forward', icon: Repeat2 },
}

/** Tailwind classes for a kind's icon tint + left-border accent, built from
 *  the `--tag-*` tokens. Undefined for kinds with no tag hue (see above). */
function kindAccentClass(tagAccent: string | undefined): string | undefined {
  if (!tagAccent) return undefined
  return {
    action: 'text-tag-action border-l-tag-action',
    discussion: 'text-tag-discussion border-l-tag-discussion',
    question: 'text-tag-question border-l-tag-question',
    term: 'text-tag-term border-l-tag-term',
  }[tagAccent as 'action' | 'discussion' | 'question' | 'term']
}

/* --- fixed panel identity (ids, order, defaults) ----------------------- */

export const PANEL_IDS = [
  // First on purpose. It is the only panel whose value changes what the panels
  // below it say: the agreed next meeting is the default deadline every
  // dateless action item inherits (notes.ts, MeetingTaskContext).
  'next-meeting',
  // ORDER IS THE PAGE'S ARGUMENT, and it goes: what is owed, what happened,
  // what is still open, what is next, what was said.
  //
  // Action items ahead of Summary is the one that looks wrong and is not: a
  // reader who attended the meeting does not need it summarised, they need
  // their own name and a date, and they were scrolling past the summary to
  // find it. A reader who missed it reads the summary either way — one panel
  // lower costs them a glance, where the reverse cost somebody their work.
  'action-items',
  'summary',
  'discussion',
  'for-next-meeting',
  'glossary',
  'carried-forward',
  'around-the-table',
  'plan-the-meeting',
  'needs-attribution',
  'record',
] as const
export type PanelId = (typeof PANEL_IDS)[number]

/** Whether a panel starts open before any stored preference is read — see
 *  the spec's panel table for the reasoning behind Glossary and Record
 *  starting collapsed. */
export const PANEL_DEFAULT_OPEN: Record<PanelId, boolean> = {
  // Open, and cheap to be: it renders one date already loaded with the intel,
  // and its whole job is to be answered rather than found. A collapsed default
  // would hide the one field that governs the deadlines below it.
  'next-meeting': true,
  summary: true,
  'action-items': true,
  discussion: true,
  'for-next-meeting': true,
  glossary: false,
  // Collapsed on arrival, like Record, and for a cost reason rather than a
  // taste one: opening it runs the planner's batched read (see
  // planner-actions.ts, which includes a workspace-wide health pass), and a
  // thirty-meeting list must not pay for that thirty times over for panels
  // nobody asked to see. The panel nav always lists it, so it is one click
  // away rather than hidden.
  'plan-the-meeting': false,
  'around-the-table': true,
  'needs-attribution': true,
  'carried-forward': true,
  record: false,
}

/* --- persisted preferences: localStorage as an external store ----------- */

/*
 * Density, per-panel open state and the summary language are read through
 * `useSyncExternalStore` rather than hydrated into `useState` from an effect.
 * localStorage IS an external system, and this is React's own contract for
 * one: the server snapshot is the default (so SSR and the hydration render
 * agree byte-for-byte), and the client snapshot is what this browser
 * remembers — React swaps to it right after hydration without a mismatch,
 * which is exactly the one-frame trade-off the old effect made, minus the
 * setState-in-effect cascade. Same-tab writes announce themselves on a
 * custom event; the native 'storage' event covers other tabs for free.
 */
const PANEL_PREFS_EVENT = 'logpup:writeup-prefs'

function subscribeToPanelPrefs(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  window.addEventListener(PANEL_PREFS_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(PANEL_PREFS_EVENT, callback)
  }
}

/** Where a value lands when localStorage refuses the write (private mode,
 *  hardened browser): the toggle still works for this session, it just is
 *  not remembered — which is what the old useState version effectively did. */
const memoryFallback = new Map<string, string>()

/** Reads never throw: blocked storage just means defaults (or this session's
 *  in-memory value) instead of a remembered preference. */
function readStored(key: string): string | null {
  const fallback = memoryFallback.get(key)
  if (fallback !== undefined) return fallback
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Writes never throw either — a preference that cannot be saved is not an
 *  error worth interrupting anyone over. Callers broadcast after the batch. */
function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
    memoryFallback.delete(key)
  } catch {
    memoryFallback.set(key, value)
  }
}

function broadcastPanelPrefs() {
  window.dispatchEvent(new Event(PANEL_PREFS_EVENT))
}

function getDensitySnapshot(): Density {
  return resolveDensity(readStored(DENSITY_STORAGE_KEY))
}
function getDensityServerSnapshot(): Density {
  return resolveDensity(null)
}

/** Stable server-side answer for the open map: empty, so every Panel falls
 *  back to its own PANEL_DEFAULT_OPEN entry — exactly what the server HTML
 *  showed before this store existed. */
const EMPTY_OPEN_MAP: Partial<Record<PanelId, boolean>> = {}

/**
 * getSnapshot must return a REFERENTIALLY stable value while the store is
 * unchanged, or useSyncExternalStore loops — so the parsed map is cached
 * against the raw stored strings and only rebuilt when one of them moves.
 * Module-level on purpose: localStorage is global, so its cache is too.
 */
let openMapCache: { raw: string; value: Partial<Record<PanelId, boolean>> } | null = null

function getOpenMapSnapshot(): Partial<Record<PanelId, boolean>> {
  const stored = PANEL_IDS.map((id) => readStored(PANEL_STORAGE_PREFIX + id) ?? '')
  const raw = stored.join('|')
  if (openMapCache && openMapCache.raw === raw) return openMapCache.value
  const value: Partial<Record<PanelId, boolean>> = {}
  PANEL_IDS.forEach((id, index) => {
    // Only stored answers land in the map — a panel nobody has ever toggled
    // stays absent, so its own default keeps deciding (see Panel).
    if (stored[index] !== '') value[id] = resolvePanelOpen(stored[index], PANEL_DEFAULT_OPEN[id])
  })
  openMapCache = { raw, value }
  return value
}
function getOpenMapServerSnapshot(): Partial<Record<PanelId, boolean>> {
  return EMPTY_OPEN_MAP
}

function getSummaryLanguageSnapshot(): SummaryLanguage {
  return resolveSummaryLanguage(readStored(SUMMARY_LANGUAGE_STORAGE_KEY))
}
function getSummaryLanguageServerSnapshot(): SummaryLanguage {
  return DEFAULT_SUMMARY_LANGUAGE
}

/* --- context ------------------------------------------------------------ */

type PanelsContextValue = {
  filters: ActiveFilters
  setPersonFilter: (id: string | null) => void
  toggleKindFilter: (kind: ContentKind) => void
  clearAllFilters: () => void
  density: Density
  setDensity: (d: Density) => void
  openMap: Partial<Record<PanelId, boolean>>
  setPanelOpen: (id: PanelId, open: boolean) => void
  expandAll: () => void
  collapseAll: () => void
  people: PersonFilterOption[]
  currentUserId: string
}

const PanelsContext = createContext<PanelsContextValue | null>(null)

/** Every hook/component below this line except MeetingPanelsProvider itself
 *  must be rendered inside one — throwing here beats a silently-inert filter
 *  bar. */
export function usePanels(): PanelsContextValue {
  const ctx = useContext(PanelsContext)
  if (!ctx) throw new Error('usePanels must be used within a MeetingPanelsProvider')
  return ctx
}

export function MeetingPanelsProvider({
  people,
  currentUserId,
  children,
}: {
  people: PersonFilterOption[]
  currentUserId: string
  children: ReactNode
}) {
  const [filters, setFilters] = useState<ActiveFilters>(NO_FILTERS)
  // The store IS the state: writing localStorage and broadcasting is what
  // re-renders every subscriber (this provider, and any other open tab).
  const density = useSyncExternalStore(
    subscribeToPanelPrefs,
    getDensitySnapshot,
    getDensityServerSnapshot,
  )
  const openMap = useSyncExternalStore(
    subscribeToPanelPrefs,
    getOpenMapSnapshot,
    getOpenMapServerSnapshot,
  )

  function setPanelOpen(id: PanelId, value: boolean) {
    writeStored(PANEL_STORAGE_PREFIX + id, value ? '1' : '0')
    broadcastPanelPrefs()
  }

  function expandAll() {
    for (const id of PANEL_IDS) writeStored(PANEL_STORAGE_PREFIX + id, '1')
    broadcastPanelPrefs()
  }

  function collapseAll() {
    for (const id of PANEL_IDS) writeStored(PANEL_STORAGE_PREFIX + id, '0')
    broadcastPanelPrefs()
  }

  function setDensity(value: Density) {
    writeStored(DENSITY_STORAGE_KEY, value)
    broadcastPanelPrefs()
  }

  const value: PanelsContextValue = {
    filters,
    setPersonFilter: (id) => setFilters((prev) => ({ ...prev, personId: id })),
    toggleKindFilter: (kind) => setFilters((prev) => ({ ...prev, kinds: toggleKind(prev.kinds, kind) })),
    clearAllFilters: () => setFilters(clearFiltersModel()),
    density,
    setDensity,
    openMap,
    setPanelOpen,
    expandAll,
    collapseAll,
    people,
    currentUserId,
  }

  return <PanelsContext.Provider value={value}>{children}</PanelsContext.Provider>
}

/** Filters `rows` down to what the active filters allow, given a mapper to
 *  the abstract FilterableItem shape each row implies. Small lists (a
 *  meeting's worth of action items, not a database query) — plain filter on
 *  every render is intentional, not a missed useMemo. */
export function useFilteredRows<T>(rows: T[], toItem: (row: T) => FilterableItem) {
  const { filters, people } = usePanels()
  const visible = rows.filter((row) => matchesFilters(toItem(row), filters, people))
  return { visible, visibleCount: visible.length, totalCount: rows.length, isFiltering: hasActiveFilters(filters) }
}

export function useSummaryLanguage(): [SummaryLanguage, (value: SummaryLanguage) => void] {
  // Same store contract as the provider above: the server snapshot is the
  // default, this browser's remembered choice arrives right after hydration,
  // and every mounted control (and other tabs) re-reads on the broadcast.
  const value = useSyncExternalStore(
    subscribeToPanelPrefs,
    getSummaryLanguageSnapshot,
    getSummaryLanguageServerSnapshot,
  )
  const set = useCallback((next: SummaryLanguage) => {
    writeStored(SUMMARY_LANGUAGE_STORAGE_KEY, next)
    broadcastPanelPrefs()
  }, [])
  return [value, set]
}

/* --- Panel: the collapsible, counted, kind-accented section shell ------- */

export function Panel({
  id,
  title,
  icon: Icon,
  count,
  kind,
  headerExtra,
  className,
  children,
}: {
  id: PanelId
  title: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /** Visible count badge — pass the FILTERED (currently visible) count when
   *  the panel has content to count; omit entirely for panels that aren't a
   *  list (e.g. nothing renders a "0" badge on an empty operational panel). */
  count?: number
  /** Which content-kind identity this panel's header wears, if any. */
  kind?: ContentKind
  /** Rendered as a sibling of the toggle button, never nested inside it —
   *  e.g. the "Add follow-up" button on Carried forward, or the auto-assign
   *  switch on Record. Nesting a real button inside the toggle button would
   *  be invalid HTML and unreachable by keyboard past the outer button. */
  headerExtra?: ReactNode
  /** Grid placement from the caller — a panel does not know how many columns
   *  it is sitting in, so spanning is the layout's decision, not its own. */
  className?: string
  children: ReactNode
}) {
  const { openMap, setPanelOpen } = usePanels()
  const open = openMap[id] ?? PANEL_DEFAULT_OPEN[id]
  const bodyId = `${id}-panel-body`
  const accent = kind ? kindAccentClass(KIND_META[kind].tagAccent) : undefined

  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-24 rounded-lg border border-border bg-card',
        accent && 'border-l-2',
        accent,
        className,
      )}
    >
      <div className="flex items-center gap-2 px-1 py-1">
        <h4 className="min-w-0 flex-1 font-heading">
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-2.5 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setPanelOpen(id, !open)}
          >
            {/* Same convention as MeetingPrepSection's own chevron: no
                rotation closed, rotate-180 open — kept identical rather than
                inventing a second disclosure idiom next to it. */}
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
                open && 'rotate-180',
              )}
              aria-hidden
            />
            <Icon className={cn('size-4 shrink-0', accent ? undefined : 'text-muted-foreground')} aria-hidden />
            <span className="truncate text-sm font-semibold text-foreground">{title}</span>
            {count !== undefined ? (
              <span className="font-mono text-xs font-normal text-muted-foreground">{count}</span>
            ) : null}
          </button>
        </h4>
        {headerExtra ? <div className="shrink-0 pr-1">{headerExtra}</div> : null}
      </div>
      {open ? (
        <div id={bodyId} className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
          {children}
        </div>
      ) : null}
    </section>
  )
}

/** The plain bordered frame given to panels whose content is an existing,
 *  self-collapsing component (MeetingPrepSection) that this redesign
 *  deliberately does not rewrite — see the spec's "not touching
 *  note-timeline.tsx or meeting-prep.tsx internals" avoided default. */
export const PANEL_FRAME_CLASS = 'scroll-mt-24 rounded-lg border border-border bg-card p-3'

/* --- layout: nav rail + content column ---------------------------------- */

export type PanelNavItem = {
  id: PanelId
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  count?: number
}

export function PanelNav({ items }: { items: PanelNavItem[] }) {
  const { openMap, setPanelOpen } = usePanels()

  function goTo(id: PanelId) {
    setPanelOpen(id, true)
    // Let the just-opened body mount before scrolling to it.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <nav aria-label="Write-up sections" className="lg:sticky lg:top-18 lg:max-h-[calc(100dvh-5.5rem)] lg:w-44 lg:shrink-0 lg:self-start lg:overflow-y-auto">
      <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:w-full lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const Icon = item.icon
          const open = openMap[item.id] ?? PANEL_DEFAULT_OPEN[item.id]
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(item.id)}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  open && 'border-border bg-muted/60 text-foreground',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
                {item.count !== undefined ? (
                  <span className="font-mono text-2xs text-muted-foreground">{item.count}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function PanelsLayout({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
      {nav}
      {/* min-w-0 so wide content (e.g. a transcript line) scrolls inside its
          own container rather than pushing the page body wider than the
          viewport. */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </div>
  )
}

/* --- filter bar ----------------------------------------------------------- */

function FilterChip({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active
          ? 'border-primary/40 bg-primary/8 text-primary'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  )
}

/**
 * The two densities, each stating what it actually changes. "Compact" used to
 * mean slightly tighter padding, which is a difference you have to hunt for;
 * it now means two panels per row on a wide screen, which is the one worth
 * naming in the hint.
 */
const DENSITY_OPTIONS = [
  {
    id: 'comfortable',
    label: 'Comfortable',
    hint: 'one panel per row, roomier spacing',
    icon: Rows2Icon,
  },
  {
    id: 'compact',
    label: 'Compact',
    hint: 'two panels per row on a wide screen, tighter spacing',
    icon: Rows4Icon,
  },
] as const satisfies readonly {
  id: Density
  label: string
  hint: string
  icon: typeof Rows2Icon
}[]

function DensityToggle({ value, onChange }: { value: Density; onChange: (d: Density) => void }) {
  return (
    // role="group" + aria-label matches the same pattern already used for
    // every other chip/segmented-control group in this codebase (directory.tsx,
    // as-of-picker.tsx, meeting-rsvp.tsx, apps-browser.tsx) — kept identical
    // rather than introducing a one-off <fieldset> next to a dozen of these.
    <div className="inline-flex items-center rounded-md border border-border p-0.5" role="group" aria-label="Density">
      {DENSITY_OPTIONS.map(({ id, label, hint, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          // What the option DOES, for anyone who cannot see the two-column
          // layout change — the icons differ by line count, which is a
          // distinction a screen reader gets nothing from.
          aria-label={`${label} — ${hint}`}
          title={hint}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value === id
              ? 'bg-secondary text-secondary-foreground'
              : // Was text-muted-foreground, which on the card background sat
                // close enough to the border to read as disabled rather than
                // as the option you can switch to.
                'text-foreground/70 hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Person + kind chips, density toggle, expand/collapse-all and a clear-all
 * action. `kindTotals` is the UNFILTERED count per kind (how much of that
 * kind exists at all, regardless of the current filter) — a kind chip must
 * still show its true count while excluded, or there is no way to tell
 * whether re-including it is worth doing.
 */
export function FilterBar({ kindTotals }: { kindTotals: Record<ContentKind, number> }) {
  const { filters, setPersonFilter, toggleKindFilter, clearAllFilters, density, setDensity, expandAll, collapseAll, people, currentUserId } =
    usePanels()
  const active = hasActiveFilters(filters)
  const selfOption = people.find((p) => p.id === currentUserId)
  const others = people.filter((p) => p.id !== currentUserId)

  const filterSummary = (() => {
    if (!active) return ''
    const parts: string[] = []
    if (filters.personId) {
      const person = people.find((p) => p.id === filters.personId)
      parts.push(person ? `showing only ${person.name}'s items` : 'a person filter')
    }
    if (filters.kinds) {
      parts.push(`kinds: ${[...filters.kinds].map((k) => KIND_META[k].label).join(', ')}`)
    }
    return `Filters active — ${parts.join('; ')}.`
  })()

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-2.5">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by person">
        <span aria-hidden className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
          Person
        </span>
        <FilterChip active={filters.personId === null} onClick={() => setPersonFilter(null)}>
          Everyone
        </FilterChip>
        {selfOption ? (
          <FilterChip
            active={filters.personId === selfOption.id}
            onClick={() => setPersonFilter(filters.personId === selfOption.id ? null : selfOption.id)}
            icon={UserRound}
          >
            Mine
          </FilterChip>
        ) : null}
        {others.map((person) => (
          <FilterChip
            key={person.id}
            active={filters.personId === person.id}
            onClick={() => setPersonFilter(filters.personId === person.id ? null : person.id)}
          >
            {person.name}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by content kind">
        <span aria-hidden className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
          Kind
        </span>
        {CONTENT_KINDS.map((kind) => {
          const meta = KIND_META[kind]
          const included = !filters.kinds || filters.kinds.has(kind)
          return (
            <FilterChip key={kind} active={included} onClick={() => toggleKindFilter(kind)} icon={meta.icon}>
              {meta.label} <span className="font-mono">{kindTotals[kind]}</span>
            </FilterChip>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <DensityToggle value={density} onChange={setDensity} />
          <Button variant="ghost" size="sm" type="button" onClick={expandAll}>
            Expand all
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={collapseAll}>
            Collapse all
          </Button>
        </div>
        {active ? (
          <Button variant="outline" size="sm" type="button" onClick={clearAllFilters}>
            <X aria-hidden /> Clear filters
          </Button>
        ) : null}
      </div>

      {/* Silent at rest — only speaks up when a filter actually changes what
          is visible, so it never narrates the unfiltered, unremarkable case. */}
      <p className="sr-only" role="status">
        {filterSummary}
      </p>
    </div>
  )
}

/** Shown inside a Panel when the active filters leave nothing to show —
 *  distinct from "this meeting produced nothing here" (that has no filters
 *  to clear). `role="status"` announces it the moment it appears. */
export function EmptyFilterState({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground"
    >
      {label}
      <Button variant="ghost" size="sm" type="button" onClick={onClear} className="h-auto px-1.5 py-0.5 text-xs">
        Clear filter
      </Button>
    </p>
  )
}

export function SummaryLanguageControl({
  value,
  onChange,
  hasSinhala,
}: {
  value: SummaryLanguage
  onChange: (v: SummaryLanguage) => void
  hasSinhala: boolean
}) {
  // Nothing to toggle when the model never wrote a distinct Sinhala section —
  // a dead "සිංහල" option is worse than no control at all.
  if (!hasSinhala) return null

  const options: { value: SummaryLanguage; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'si', label: 'සිංහල' },
    { value: 'both', label: 'Both' },
  ]

  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5" role="group" aria-label="Summary language">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded px-2 py-1 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value === option.value ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
