'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/shell/theme-provider'
import { toast } from 'sonner'
import { CalendarDays, Check, CloudOff, Keyboard, Loader2, PawPrint, Plus, Search, Sparkles } from 'lucide-react'
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import { activityNavItem, navItems } from '@/components/shell/nav-items'
import { setSidebarState, useSidebarState } from '@/components/shell/sidebar-store'
import { ShortcutsOverlay } from '@/components/shell/shortcuts-overlay'
import { cn } from '@/lib/utils'
import { createDeduper } from '@/lib/dedupe'
import { openIntelBubble } from '@/features/intel/bubble-bus'
import { askAvailable } from '@/features/intel/actions'
import { usePrefetchIntent } from '@/hooks/use-prefetch-intent'
import {
  universalSearch,
  quickAssignTask,
  previewTaskIntent,
  type TaskIntentPreview,
} from '../actions'
import { paletteCommands, type ResolvedCommand } from '../registry/commands'
import { KIND_META } from '../registry/kinds'
import { MIN_QUERY_LENGTH } from '../registry/limits'
import type { CommandApi, PaletteContext, PaletteRecent, SearchGroup } from '../registry/types'

type Recent = PaletteRecent

const RECENTS_KEY = 'logpup.recents.v1'
const GO_SHORTCUTS_KEY = 'logpup.goShortcuts'
/* One shared empty array, so a reset never makes a new object and re-renders
   the list for no reason. */
const EMPTY_RESULTS: SearchGroup[] = []

/**
 * REQUEST DEDUPLICATION for the palette's two server round trips.
 *
 * The 180ms debounce below stops a *keystroke* from being a request, and the
 * sequence guard stops a slow response from overwriting a newer one — but
 * neither stops the same query being asked for twice. Typing "pupp",
 * backspacing to "pup", and typing forward again lands on a query that was
 * just answered; opening the palette and retyping a name a few seconds later
 * does the same. Both hit the database again for a result the browser already
 * had.
 *
 * Module-level so it survives closing and reopening the dialog, which is
 * exactly when a repeat is most likely. The TTL is short on purpose: results
 * name live tasks, sprints and people, and 30 seconds is about as stale as a
 * jump-to-thing list can be before it starts sending people to the wrong
 * place. `quickAssignTask` clears both — it creates a task, so every retained
 * answer is now potentially wrong.
 */
const SEARCH_TTL_MS = 30_000
const searchDeduper = createDeduper<SearchGroup[]>({ ttlMs: SEARCH_TTL_MS })
const intentDeduper = createDeduper<TaskIntentPreview | null>({ ttlMs: SEARCH_TTL_MS })

const CommandCenterContext = React.createContext<{ setOpen: (open: boolean) => void } | null>(null)

export function useCommandCenter() {
  const ctx = React.useContext(CommandCenterContext)
  if (!ctx) throw new Error('useCommandCenter must be used within CommandCenterProvider')
  return ctx
}

/**
 * Sequential "g then key" jumps for keyboard-first navigation.
 *
 * Derived from the nav instead of written out again here, because the letter a
 * sidebar row shows on hover has to BE the letter this handler answers to.
 * Written by hand the two drifted: the Work log row advertised "G W" while
 * this map only knew d/a/p/m, so the one page people are asked to open daily
 * had a hint that did nothing. Give a nav item a `key` and both surfaces —
 * hint, handler, and the palette chips below — gain it together.
 */
const GO_TARGETS = [...navItems, activityNavItem].flatMap((item) =>
  // activityNavItem is listed explicitly because it left the sidebar but kept
  // its jump: `g v` must keep working for anybody who already has the habit,
  // and dropping it here would have retired the shortcut silently.
  item.key ? [{ key: item.key, href: item.href }] : [],
)
const GO_KEYS: Record<string, string> = Object.fromEntries(
  GO_TARGETS.map((target) => [target.key.toLowerCase(), target.href] as const),
)

/**
 * Single-key jumps are opt-out per browser (WCAG 2.1.4). Everything that
 * fires them — and everything that advertises them — asks this one question,
 * so the palette never shows a jump letter that would not work.
 */
function goShortcutsEnabled(): boolean {
  try {
    return window.localStorage.getItem(GO_SHORTCUTS_KEY) !== 'off'
  } catch {
    /* No storage (private mode, blocked): the handler's own read fails the
       same way and jumps stay on, so say on. */
    return true
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function readRecents(): Recent[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Recent[]).slice(0, 8) : []
  } catch {
    return []
  }
}

/* Ember (chart-1) is reserved for attention states; work in flight uses the
   working color, planned/neutral states use the quiet pine tint.

   Never hue alone (WCAG 1.4.1): every status also gets its own SHAPE, so the
   colorblind read matches the color read — filled dot = in flight, hollow
   ring = paused, hollow square = planned, dashed ring = not started, check
   glyph = finished. The sr-only word beside the glyph is the one and only
   announcement; every visual is aria-hidden so status is never read twice. */
type StatusShape = 'dot' | 'ring' | 'square' | 'dashed' | 'check'
const STATUS_DOT: Record<string, { shape: StatusShape; className: string }> = {
  active: { shape: 'dot', className: 'bg-primary' },
  in_progress: { shape: 'dot', className: 'bg-primary' },
  paused: { shape: 'ring', className: 'border-chart-1' },
  planned: { shape: 'square', className: 'border-chart-2' },
  todo: { shape: 'dashed', className: 'border-muted-foreground/60' },
  done: { shape: 'check', className: 'text-muted-foreground/70' },
  archived: { shape: 'check', className: 'text-muted-foreground/70' },
}

function StatusDot({ status }: { status: string }) {
  const meta = STATUS_DOT[status] ?? { shape: 'dot' as const, className: 'bg-border' }
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      {meta.shape === 'check' ? (
        <Check aria-hidden strokeWidth={3} className={cn('size-3', meta.className)} />
      ) : (
        <span
          aria-hidden
          className={cn(
            meta.shape === 'dot' && 'size-1.5 rounded-full',
            meta.shape === 'ring' && 'size-2 rounded-full border-2 bg-transparent',
            meta.shape === 'square' && 'size-1.5 border bg-transparent',
            meta.shape === 'dashed' && 'size-2 rounded-full border border-dashed bg-transparent',
            meta.className,
          )}
        />
      )}
      <span className="sr-only">{status.replace('_', ' ')}</span>
    </span>
  )
}

export function CommandCenterProvider({
  user,
  children,
}: {
  /* The whole session user, not an `isAdmin` boolean: a command decides its
     own visibility (registry/types.ts), and rules like "admin or the
     assignee" cannot be expressed once the session has been flattened to one
     flag on the way in. */
  user: PaletteContext['user']
  children: React.ReactNode
}) {
  const router = useRouter()
  const { theme, setTheme, accent, setAccent } = useTheme()
  /**
   * OPTIMISTIC PRELOADING for the palette's results.
   *
   * Everything here navigates through `router.push`, not `<Link>`, so none of
   * it benefits from Next's automatic viewport prefetching — the palette is
   * the fastest way to ask for a page in this app and the slowest way to
   * receive it. Resting on a row (or arrowing onto it) now warms the route
   * while the person is still reading the label. See hooks/use-prefetch-intent.ts
   * for the once-per-href and hover-intent guards that keep an idle sweep
   * through a long result list from prefetching all of it.
   */
  const { intentProps } = usePrefetchIntent()
  const [open, setOpen] = React.useState(false)
  /* Whether to offer the "Ask LogPup" fallback at all. Resolved once per open
     rather than per keystroke: it reads prefs and key presence, and the answer
     cannot change while the palette is on screen. ONE predicate, not two —
     askAvailable() owns routed-ness, the feature pref and key presence
     together, so this row cannot advertise a dead end that the action would
     then refuse. Defaults to false, which is the safe direction: a missing
     answer hides the row rather than promising an answer nobody can get. */
  const [canAsk, setCanAsk] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    let live = true
    void askAvailable()
      .then((ok) => {
        if (live) setCanAsk(ok)
      })
      .catch(() => {
        if (live) setCanAsk(false)
      })
    return () => {
      live = false
    }
  }, [open])
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchGroup[]>(EMPTY_RESULTS)
  const [searching, setSearching] = React.useState(false)
  /* A failed round-trip is an OUTAGE, not an empty workspace. Kept separate
     from `results` so the error row can never be mistaken for (or rendered
     as) the "nothing to fetch" empty state. `searchRetry` re-runs the search
     effect for the SAME query — the deduper never retains rejections
     (lib/dedupe.ts), so a retry is a real second request, not a cached
     failure served back. */
  const [searchError, setSearchError] = React.useState(false)
  const [searchRetry, setSearchRetry] = React.useState(0)
  const [assigning, setAssigning] = React.useState(false)
  /* The "?" shortcuts overlay. A ref mirror lets the window key handler read
     "is it open" without re-subscribing on every toggle — the same reason the
     g-prefix lives in a ref. */
  const [shortcutsOpen, setShortcutsOpenState] = React.useState(false)
  const shortcutsOpenRef = React.useRef(false)
  const setShortcutsOpen = React.useCallback((next: boolean) => {
    shortcutsOpenRef.current = next
    setShortcutsOpenState(next)
  }, [])
  const [intent, setIntent] = React.useState<TaskIntentPreview | null>(null)
  const intentSeq = React.useRef(0)
  const [recents, setRecents] = React.useState<Recent[]>([])
  const searchSeq = React.useRef(0)
  /* Whether "g then key" is switched on, so the palette only prints the jump
     letters while pressing them does something. Read once on mount rather
     than on every render: the dialog's contents exist only while it is open,
     so nothing here is rendered on the server and there is no first paint to
     get wrong. The toggle below is the only thing that writes it. */
  const [goShortcutsOn, setGoShortcutsOn] = React.useState(goShortcutsEnabled)
  /* Whether the desktop sidebar is wide or a rail, so its row can name the
     move it will make. Read through the same external store the sidebar
     itself renders from — not a second copy of the localStorage read — so the
     row and the column can never disagree about which way the switch is
     pointing, and so a toggle from either surface re-renders both. */
  const sidebar = useSidebarState()
  const goPrefix = React.useRef<number | null>(null)
  const paletteGoPrefix = React.useRef<number | null>(null)
  const paletteGoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ⌘K / Ctrl+K opens; "?" toggles the shortcuts overlay; "g then <key>"
     jumps to whichever nav item carries that letter (GO_KEYS above). */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      // During IME composition: a composed keystroke is mid-word, not a
      // shortcut. Without this, typing Sinhala — the second language this app
      // is written in — would fire g-jumps mid-word.
      if (event.isComposing) return
      /* Overlay check shared by "?" and the g-jumps: single keys must never
         fire inside dialogs, menus or pickers (WCAG 2.1.4) — with one
         exception below: "?" while the shortcuts overlay ITSELF is open acts
         as a close toggle rather than a dead key. */
      const inOverlay =
        event.target instanceof HTMLElement &&
        event.target.closest(
          '[role="dialog"],[role="menu"],[role="listbox"],[role="combobox"],[role="textbox"]',
        ) !== null
      if (event.key === '?') {
        if (shortcutsOpenRef.current) {
          event.preventDefault()
          setShortcutsOpen(false)
          return
        }
        if (inOverlay) return
        event.preventDefault()
        /* An armed g-prefix dies here: the overlay is modal, so the second
           key of a half-typed jump would land inside it anyway. */
        goPrefix.current = null
        setShortcutsOpen(true)
        return
      }
      /* Never fire single-key jumps inside overlays, or when the user opted
         out (WCAG 2.1.4). */
      if (inOverlay || !goShortcutsEnabled()) return
      const key = event.key.toLowerCase() // tolerate Shift/Caps Lock
      if (goPrefix.current !== null && Date.now() - goPrefix.current < 800) {
        const href = GO_KEYS[key]
        goPrefix.current = null
        if (href) {
          event.preventDefault()
          router.push(href)
        }
        return
      }
      if (key === 'g') goPrefix.current = Date.now()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router, setShortcutsOpen])

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dialog state on open, recents come from localStorage
      setRecents(readRecents())
      setQuery('')
      setResults(EMPTY_RESULTS)
    }
    paletteGoPrefix.current = null
    if (paletteGoTimer.current) {
      clearTimeout(paletteGoTimer.current)
      paletteGoTimer.current = null
    }
  }, [open])

  /* Debounced natural-language parse, so the preview shows who/what/when the
     phrase resolved to before Enter creates anything. Same stale-response
     guard as the search below. */
  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 4) {
      intentSeq.current++
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the preview once the query is too short to be a task
      setIntent(null)
      return
    }
    const seq = ++intentSeq.current
    const timer = setTimeout(async () => {
      try {
        const parsed = await intentDeduper.run(trimmed, () => previewTaskIntent(trimmed))
        if (intentSeq.current === seq) setIntent(parsed)
      } catch {
        if (intentSeq.current === seq) setIntent(null)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

  /* Debounced server search; stale responses are dropped by sequence id.
     `searchRetry` is a dep on purpose: bumping it re-runs this effect for an
     unchanged query, which is exactly what the error row's Retry does. */
  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      searchSeq.current++ // invalidate any in-flight response so it can't repopulate results
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear pending results when the query drops below the threshold
      setResults(EMPTY_RESULTS)
      setSearching(false)
      setSearchError(false)
      return
    }
    setSearching(true)
    setSearchError(false)
    const seq = ++searchSeq.current
    const timer = setTimeout(async () => {
      try {
        const res = await searchDeduper.run(trimmed, () => universalSearch(trimmed))
        if (searchSeq.current === seq) setResults(res)
      } catch {
        /* NOT swallowed into the empty state: results are cleared so no stale
           group lingers, and the flag routes rendering to the error row. */
        if (searchSeq.current === seq) {
          setResults(EMPTY_RESULTS)
          setSearchError(true)
        }
      } finally {
        if (searchSeq.current === seq) setSearching(false)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [query, searchRetry])

  const pushRecent = React.useCallback((recent: Recent) => {
    try {
      const next = [recent, ...readRecents().filter((r) => r.href !== recent.href)].slice(0, 8)
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
    } catch {
      /* Private mode / quota — recents are a convenience, not a requirement. */
    }
  }, [])

  const go = React.useCallback(
    (href: string, recent?: Recent) => {
      setOpen(false)
      if (recent) pushRecent(recent)
      router.push(href)
    },
    [pushRecent, router],
  )

  /* "g then key" also works inside the palette while the input is empty.
     The swallowed "g" is restored into the query if the user keeps typing
     (or after the 800ms window lapses), so searching for "google…" still works. */
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key.toLowerCase()
    if (paletteGoPrefix.current !== null && Date.now() - paletteGoPrefix.current < 800) {
      if (paletteGoTimer.current) {
        clearTimeout(paletteGoTimer.current)
        paletteGoTimer.current = null
      }
      paletteGoPrefix.current = null
      const href = GO_KEYS[key]
      if (href) {
        event.preventDefault()
        go(href)
        return
      }
      if (event.key.length === 1) {
        event.preventDefault()
        setQuery(`g${event.key}`)
      }
      return
    }
    /* Same switch as the global handler. Someone who turned jumps off did it
       to stop single keys behaving like commands, and this input swallowing
       their "g" for 800ms is exactly that. Checked only where a prefix is
       armed — the branch above can't run without one. */
    if (key === 'g' && query === '' && goShortcutsEnabled()) {
      event.preventDefault()
      paletteGoPrefix.current = Date.now()
      paletteGoTimer.current = setTimeout(() => {
        paletteGoPrefix.current = null
        paletteGoTimer.current = null
        setQuery('g')
      }, 800)
    }
  }

  /* Natural-language quick-assign: "@sam fix login" or
     "assign fix login to sam on logpup" creates a backlog task directly. */
  const handleQuickAssign = React.useCallback(async () => {
    const raw = query.trim()
    if (!raw || assigning) return
    setAssigning(true)
    try {
      const res = await quickAssignTask(raw)
      // A task now exists that no retained answer knows about — drop them all
      // rather than let the palette keep serving a pre-write view of the
      // workspace for the rest of the TTL.
      searchDeduper.clear()
      intentDeduper.clear()
      if (res.ok) {
        toast.success(`Task "${res.data.title}" → ${res.data.assigneeName} on ${res.data.appName}`)
        go(res.data.href)
      } else {
        toast.error(res.error)
      }
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setAssigning(false)
    }
  }, [assigning, go, query])

  const q = query.trim().toLowerCase()

  /* Turning the jumps on or off is a stored preference, a piece of local
     state and a toast — all three, or the chips start describing a state the
     next keypress will contradict. */
  const setGoShortcuts = React.useCallback((on: boolean) => {
    try {
      window.localStorage.setItem(GO_SHORTCUTS_KEY, on ? 'on' : 'off')
    } catch {
      /* localStorage unavailable. The key handler reads that same store, so
         nothing actually changed — say so rather than pretend. */
      toast.error('This browser would not save that — shortcuts are unchanged')
      return
    }
    setGoShortcutsOn(on)
    toast.info(on ? 'Go-to shortcuts enabled' : 'Go-to shortcuts disabled')
  }, [])

  /* Everything a command is allowed to do. Deliberately this small: a row
     that needs more than navigate / close / flip a shell switch / drop the
     search cache is a page, not a palette row. */
  const commandApi = React.useMemo<CommandApi>(
    () => ({
      go,
      close: () => setOpen(false),
      setTheme,
      setAccent,
      setGoShortcuts,
      /* Straight through: the store writes storage, keeps its own memory
         fallback when storage refuses, and broadcasts — there is nothing for
         the palette to add, and a toast for a change you are watching happen
         would be noise. */
      setSidebar: setSidebarState,
      invalidateSearch: () => {
        searchDeduper.clear()
        intentDeduper.clear()
      },
    }),
    [go, setGoShortcuts, setTheme, setAccent],
  )

  /* Every static row, resolved for this person and this query in one call.
     Which rows exist, what they are called, who may see them and what matches
     them all live in features/search/registry/commands.ts — this file only
     renders what comes back, so a new feature never has to be added here. */
  const paletteCtx: PaletteContext = { user, theme, accent, goShortcutsOn, sidebar }
  const commands = paletteCommands(paletteCtx, query)
  const createCommands = commands.filter((command) => command.group === 'create')
  const navCommands = commands.filter((command) => command.group === 'navigate')
  const otherCommands = commands.filter((command) => command.group === 'command')

  const renderCommand = (command: ResolvedCommand) => {
    const Icon = command.icon
    return (
      <CommandItem
        key={command.id}
        value={command.id}
        {...(command.href ? intentProps(command.href) : {})}
        onSelect={() => {
          if (command.href) {
            go(command.href)
            return
          }
          void command.run?.(commandApi, paletteCtx)
        }}
      >
        <Icon />
        {command.label}
        {command.shortcut ? (
          // Hidden below sm for the same reason as the footer strip: the
          // palette is reachable from the header on a phone, where a chip
          // advertises a key press the device cannot make.
          <CommandShortcut className="hidden sm:inline">{command.shortcut}</CommandShortcut>
        ) : null}
      </CommandItem>
    )
  }

  /* Nothing found means nothing to show at all — no result groups AND no
     static rows the query reached. Before the registry this was a hand-kept
     list of every group that could be non-empty, which is exactly the kind of
     condition that goes stale the moment a group is added. An errored fetch
     is excluded: "the server did not answer" must never be dressed up as
     "your workspace has nothing by that name". */
  const nothingAtAll =
    q.length >= MIN_QUERY_LENGTH &&
    !searching &&
    !searchError &&
    !intent &&
    results.length === 0 &&
    commands.length === 0

  const contextValue = React.useMemo(() => ({ setOpen }), [])

  return (
    <CommandCenterContext.Provider value={contextValue}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command center"
        description="Search apps, people, tasks, sprints, and meetings, or run a command"
        className="top-[20%] sm:max-w-xl"
      >
        <Command shouldFilter={false}>
          {/* The example IS the feature. This box parses a whole sentence into
              an assignee, a due day and a priority (lib/task-intent.ts) and
              offers to create the task — something "apps, people, tasks…" gave
              nobody a reason to try. One short phrase shows the shape (name
              first, then what, then when) and still fits the input at 360px. */}
          <CommandInput
            placeholder="Fetch anything — “shanika fix login friday”"
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleInputKeyDown}
          />
          <CommandList>
            {searching ? (
              /* Three skeleton rows shaped like real result items (same
                 px-2 py-1.5 rhythm, icon square + title bar), so the list
                 does not jump when groups land. cmdk's Loading slot renders
                 role=progressbar with this label and aria-hides the visuals. */
              <CommandLoading label="Sniffing around…">
                <div className="p-1">
                  {['w-3/5', 'w-2/5', 'w-1/2'].map((width) => (
                    <div key={width} className="flex items-center gap-2 px-2 py-1.5">
                      <Skeleton className="size-4 rounded" />
                      <Skeleton className={cn('h-4', width)} />
                    </div>
                  ))}
                </div>
              </CommandLoading>
            ) : null}
            {searchError && !searching ? (
              /* A distinct row for an unreachable server — never the empty
                 state. role=alert so the failure is announced when it lands. */
              <div
                role="alert"
                className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"
              >
                <CloudOff className="size-4 shrink-0 text-destructive" aria-hidden />
                <span>Search is unreachable.</span>
                <button
                  type="button"
                  onClick={() => setSearchRetry((n) => n + 1)}
                  className="ml-auto rounded-md border border-input px-2 py-1 text-xs font-medium text-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                >
                  Retry
                </button>
              </div>
            ) : null}
            {nothingAtAll ? (
              canAsk ? (
                /* Nothing matched by NAME — which is not the same as nothing to
                   say. A question the search index cannot answer ("who is
                   blocked on Kestrel") is exactly the one worth handing to a
                   grounded answer, so the dead end becomes the entry point.
                   Only rendered when askAvailable() says the feature is routed,
                   enabled and keyed: a row that offered this and then failed
                   would be a worse dead end than the plain empty state. */
                <CommandGroup heading="Ask">
                  <CommandItem
                    value="intel-ask-fallback"
                    onSelect={() => {
                      const question = query.trim()
                      setOpen(false)
                      /* Prefills, never auto-submits — /intel owns that
                         contract. A palette row that spent someone's Gemini
                         quota on navigation would charge them for a keystroke
                         they were still typing. */
                      // Opens the bubble rather than navigating: /intel is
                      // gone, and the question travels in the event instead of
                      // a query string so nothing has to survive a round trip.
                      openIntelBubble({ view: 'ask', question })
                    }}
                  >
                    <Sparkles />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate">Ask about “{query.trim()}”</span>
                      <span className="truncate text-xs text-muted-foreground">
                        Nothing is named that — ask LogPup instead, with links to
                        the rows it used
                      </span>
                    </div>
                  </CommandItem>
                </CommandGroup>
              ) : (
                <CommandEmpty>
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <PawPrint className="size-4" aria-hidden />
                    Nothing to fetch for “{query.trim()}”.
                  </span>
                </CommandEmpty>
              )
            ) : null}

            {intent ? (
              <CommandGroup heading="New task">
                <CommandItem
                  value="smart-quick-assign"
                  disabled={assigning || !intent.assigneeName}
                  onSelect={() => void handleQuickAssign()}
                >
                  {assigning ? <Loader2 className="animate-spin" /> : <Plus />}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate">{intent.title}</span>
                    {/* Show what the phrase actually resolved to, so nothing is
                        created on a guess the user never saw. */}
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {intent.assigneeName ? (
                        <span className="text-foreground">{intent.assigneeName}</span>
                      ) : intent.ambiguousNames.length > 0 ? (
                        <span className="text-destructive">
                          {intent.ambiguousNames.join(' or ')}?
                        </span>
                      ) : intent.unresolvedName ? (
                        <span className="text-destructive">
                          no one called “{intent.unresolvedName}”
                        </span>
                      ) : (
                        <span className="text-destructive">start with a teammate’s name</span>
                      )}
                      {intent.dueLabel ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3" aria-hidden />
                          {intent.dueLabel}
                        </span>
                      ) : null}
                      {intent.appName ? <span>· {intent.appName}</span> : null}
                    </span>
                  </div>
                  {intent.assigneeName ? (
                    <CommandShortcut>↵</CommandShortcut>
                  ) : null}
                </CommandItem>
              </CommandGroup>
            ) : null}

            {!q && recents.length === 0 ? (
              /* First-run teach rows: with no query and no recents there is
                 nothing above the static commands, and the placeholder is the
                 only hint of what this box can do — and it vanishes on the
                 first keystroke. Two quiet informational rows (plain divs, so
                 arrow keys skip them) plus one real item that opens the
                 shortcuts overlay. */
              <>
                <CommandGroup heading="Get started">
                  <div className="flex items-start gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                    <Plus className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      Try “<span className="text-foreground">shanika fix login friday</span>” — it
                      creates an assigned task
                    </span>
                  </div>
                  <div className="flex items-start gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                    <Search className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>Type to find apps, people, meetings, tasks, and sprints</span>
                  </div>
                  <CommandItem
                    value="open-shortcuts-overlay"
                    onSelect={() => {
                      setOpen(false)
                      setShortcutsOpen(true)
                    }}
                  >
                    <Keyboard />
                    <span className="truncate">
                      {goShortcutsOn
                        ? 'g then a letter jumps — press ? for all shortcuts'
                        : 'Press ? for all keyboard shortcuts'}
                    </span>
                    {/* Visible at every width, unlike the sm+ footer hints:
                        this row is the one shortcut pointer phones get. */}
                    <CommandShortcut>?</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}

            {!q && recents.length > 0 ? (
              <>
                <CommandGroup heading="Recent">
                  {recents.map((recent) => {
                    /* A recent has always stored what KIND of thing it points
                       at; until the registry nothing read it, so every row
                       wore the same magnifying glass whatever it led to.
                       Entries written by older builds may carry a kind this
                       map does not know — those keep the glass. */
                    const Icon = KIND_META[recent.type]?.icon ?? Search
                    return (
                      <CommandItem
                        key={recent.href}
                        value={`recent-${recent.href}`}
                        {...intentProps(recent.href)}
                        onSelect={() => go(recent.href)}
                      >
                        <Icon />
                        <span className="truncate">{recent.label}</span>
                        {recent.sub ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {recent.sub}
                          </span>
                        ) : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}

            {/* One shape for every kind of result. The heading, the order and
                the rows all come from whichever provider produced them
                (features/search/registry/providers.ts), so making a new thing
                searchable adds a group here without this file changing. */}
            {results.map((group) => (
              <CommandGroup key={group.providerId} heading={group.label}>
                {group.hits.map((hit) => {
                  const meta = KIND_META[hit.kind]
                  return (
                    <CommandItem
                      key={hit.id}
                      value={`${group.providerId}-${hit.id}`}
                      {...intentProps(hit.href)}
                      onSelect={() =>
                        go(hit.href, {
                          type: hit.kind,
                          label: hit.title,
                          sub: hit.subtitle,
                          href: hit.href,
                        })
                      }
                    >
                      <meta.icon />
                      <span className="truncate">{hit.title}</span>
                      {hit.subtitle ? (
                        <span
                          className={cn(
                            'truncate text-xs text-muted-foreground',
                            /* Slugs are things you type; names are things you
                               read. Only the first earns the mono face. */
                            meta.mono && 'font-mono',
                          )}
                        >
                          {hit.subtitle}
                        </span>
                      ) : null}
                      {hit.status ? <StatusDot status={hit.status} /> : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}

            {createCommands.length > 0 ? (
              <CommandGroup heading="Create">{createCommands.map(renderCommand)}</CommandGroup>
            ) : null}

            {navCommands.length > 0 ? (
              <CommandGroup heading="Go to">{navCommands.map(renderCommand)}</CommandGroup>
            ) : null}

            {otherCommands.length > 0 ? (
              <CommandGroup heading="Commands">{otherCommands.map(renderCommand)}</CommandGroup>
            ) : null}
          </CommandList>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-2xs text-muted-foreground">
            <span>
              <Kbd>↑↓</Kbd> navigate
            </span>
            <span>
              <Kbd>↵</Kbd> open
            </span>
            {/* Gated on the same switch as the chips in "Go to" above: with
                jumps turned off there is no g+key to describe. */}
            {goShortcutsOn ? (
              <span className="hidden sm:inline">
                <Kbd>g</Kbd>+key jump
              </span>
            ) : null}
            {/* Keyboard hints stay sm+ (a phone cannot press them); the teach
                group's "?" row is the all-widths pointer to the same overlay. */}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setShortcutsOpen(true)
              }}
              className="hidden items-center gap-1 rounded-sm outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none sm:inline-flex"
            >
              <Kbd>?</Kbd> shortcuts
            </button>
            <span className="ml-auto inline-flex items-center gap-1">
              <PawPrint className="size-3" aria-hidden /> LogPup
            </span>
          </div>
        </Command>
      </CommandDialog>
      <ShortcutsOverlay
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        goShortcutsOn={goShortcutsOn}
      />
    </CommandCenterContext.Provider>
  )
}

export function CommandCenterTrigger({ className }: { className?: string }) {
  const { setOpen } = useCommandCenter()
  const [isMac, setIsMac] = React.useState(true)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe platform detection
    setIsMac(/Mac|iPhone|iPad/.test(window.navigator.userAgent))
  }, [])

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground shadow-xs',
        'transition-colors duration-150 hover:border-ring/40 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <Search className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">Fetch anything…</span>
      <Kbd className="ml-auto px-1.5">{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
    </button>
  )
}
