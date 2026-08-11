'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  AppWindow,
  CalendarDays,
  Keyboard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  PawPrint,
  Plus,
  Search,
  ShieldCheck,
  SquareKanban,
  Sun,
  Timer,
  User,
  Users,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'
import {
  universalSearch,
  signOutFromPalette,
  quickAssignTask,
  type SearchResults,
} from '../actions'

type Recent = {
  type: 'app' | 'person' | 'task' | 'sprint' | 'meeting' | 'page'
  label: string
  sub?: string
  href: string
}

const RECENTS_KEY = 'logpup.recents.v1'
const GO_SHORTCUTS_KEY = 'logpup.goShortcuts'
const EMPTY_RESULTS: SearchResults = { apps: [], people: [], tasks: [], sprints: [], meetings: [] }

const CommandCenterContext = React.createContext<{ setOpen: (open: boolean) => void } | null>(null)

export function useCommandCenter() {
  const ctx = React.useContext(CommandCenterContext)
  if (!ctx) throw new Error('useCommandCenter must be used within CommandCenterProvider')
  return ctx
}

/* Sequential "g then key" jumps for keyboard-first navigation. */
const GO_KEYS: Record<string, string> = {
  d: '/',
  a: '/apps',
  p: '/people',
  m: '/meetings',
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
   working color, planned/neutral states use the quiet pine tint. */
const STATUS_DOT: Record<string, string> = {
  active: 'bg-primary',
  in_progress: 'bg-primary',
  paused: 'bg-chart-1',
  planned: 'bg-chart-2',
  done: 'bg-muted-foreground/40',
  archived: 'bg-muted-foreground/40',
  todo: 'bg-muted-foreground/40',
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', STATUS_DOT[status] ?? 'bg-border')}
      />
      <span className="sr-only">{status.replace('_', ' ')}</span>
    </span>
  )
}

export function CommandCenterProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResults>(EMPTY_RESULTS)
  const [searching, setSearching] = React.useState(false)
  const [assigning, setAssigning] = React.useState(false)
  const [recents, setRecents] = React.useState<Recent[]>([])
  const searchSeq = React.useRef(0)
  const goPrefix = React.useRef<number | null>(null)
  const paletteGoPrefix = React.useRef<number | null>(null)
  const paletteGoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ⌘K / Ctrl+K opens; "g then d/a/p/m" jumps between sections. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      /* Never fire single-key jumps inside overlays (dialogs, menus, pickers),
         during IME composition, or when the user opted out (WCAG 2.1.4). */
      if (
        event.isComposing ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            '[role="dialog"],[role="menu"],[role="listbox"],[role="combobox"],[role="textbox"]',
          )) ||
        window.localStorage.getItem(GO_SHORTCUTS_KEY) === 'off'
      )
        return
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
  }, [router])

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

  /* Debounced server search; stale responses are dropped by sequence id. */
  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      searchSeq.current++ // invalidate any in-flight response so it can't repopulate results
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear pending results when the query drops below the threshold
      setResults(EMPTY_RESULTS)
      setSearching(false)
      return
    }
    setSearching(true)
    const seq = ++searchSeq.current
    const timer = setTimeout(async () => {
      try {
        const res = await universalSearch(trimmed)
        if (searchSeq.current === seq) setResults(res)
      } catch {
        if (searchSeq.current === seq) setResults(EMPTY_RESULTS)
      } finally {
        if (searchSeq.current === seq) setSearching(false)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

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
    if (key === 'g' && query === '') {
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
  const rawQuery = query.trim()
  const smartIntent =
    rawQuery.startsWith('@') || /\b(assign|create task|task)\b.+\b(to|for)\b/i.test(rawQuery)

  const handleQuickAssign = React.useCallback(async () => {
    const raw = query.trim()
    if (!raw || assigning) return
    setAssigning(true)
    try {
      const res = await quickAssignTask(raw)
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
  const pages = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard, shortcut: 'G D' },
    { label: 'Apps', href: '/apps', icon: AppWindow, shortcut: 'G A' },
    { label: 'People', href: '/people', icon: Users, shortcut: 'G P' },
    { label: 'Meetings', href: '/meetings', icon: CalendarDays, shortcut: 'G M' },
    { label: 'Profile', href: '/profile', icon: User, shortcut: undefined },
    ...(isAdmin
      ? [{ label: 'Admin', href: '/admin', icon: ShieldCheck, shortcut: undefined }]
      : []),
  ].filter((page) => !q || page.label.toLowerCase().includes(q))

  const themeActions = [
    { label: 'Theme: light', value: 'light', icon: Sun },
    { label: 'Theme: dark', value: 'dark', icon: Moon },
    { label: 'Theme: system', value: 'system', icon: Monitor },
  ].filter((action) => !q || action.label.toLowerCase().includes(q) || 'theme'.includes(q))

  const createActions = [
    { label: 'New app', href: '/apps?new=1', adminOnly: true },
    { label: 'New meeting', href: '/meetings?new=1', adminOnly: false },
  ].filter(
    (action) => (!action.adminOnly || isAdmin) && (!q || action.label.toLowerCase().includes(q)),
  )

  const showSignOut = !q || 'sign out log out'.includes(q)
  const hasEntityResults =
    results.apps.length > 0 ||
    results.people.length > 0 ||
    results.tasks.length > 0 ||
    results.sprints.length > 0 ||
    results.meetings.length > 0
  const nothingAtAll =
    q.length >= 2 &&
    !searching &&
    !smartIntent &&
    !hasEntityResults &&
    pages.length === 0 &&
    themeActions.length === 0 &&
    createActions.length === 0

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
          <CommandInput
            placeholder="Fetch anything — apps, people, tasks…"
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleInputKeyDown}
          />
          <CommandList>
            {searching ? (
              <CommandLoading>
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  Sniffing around…
                </div>
              </CommandLoading>
            ) : null}
            {nothingAtAll ? (
              <CommandEmpty>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <PawPrint className="size-4" aria-hidden />
                  Nothing to fetch for “{query.trim()}”.
                </span>
              </CommandEmpty>
            ) : null}

            {smartIntent ? (
              <CommandGroup heading="Smart">
                <CommandItem
                  value="smart-quick-assign"
                  disabled={assigning}
                  onSelect={() => void handleQuickAssign()}
                >
                  {assigning ? <Loader2 className="animate-spin" /> : <Plus />}
                  <span className="truncate">➕ {rawQuery}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    Create &amp; assign task — press Enter
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}

            {!q && recents.length > 0 ? (
              <>
                <CommandGroup heading="Recent">
                  {recents.map((recent) => (
                    <CommandItem
                      key={recent.href}
                      value={`recent-${recent.href}`}
                      onSelect={() => go(recent.href)}
                    >
                      <Search />
                      <span className="truncate">{recent.label}</span>
                      {recent.sub ? (
                        <span className="truncate text-xs text-muted-foreground">{recent.sub}</span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}

            {results.apps.length > 0 ? (
              <CommandGroup heading="Apps">
                {results.apps.map((app) => (
                  <CommandItem
                    key={app.id}
                    value={`app-${app.id}`}
                    onSelect={() =>
                      go(`/apps/${app.slug}`, {
                        type: 'app',
                        label: app.name,
                        sub: app.slug,
                        href: `/apps/${app.slug}`,
                      })
                    }
                  >
                    <AppWindow />
                    <span className="truncate">{app.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {app.slug}
                    </span>
                    <StatusDot status={app.status} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.people.length > 0 ? (
              <CommandGroup heading="People">
                {results.people.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={`person-${person.id}`}
                    onSelect={() =>
                      go(`/people/${person.id}`, {
                        type: 'person',
                        label: person.name,
                        sub: person.title ?? undefined,
                        href: `/people/${person.id}`,
                      })
                    }
                  >
                    <User />
                    <span className="truncate">{person.name}</span>
                    {person.title ? (
                      <span className="truncate text-xs text-muted-foreground">{person.title}</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.tasks.length > 0 ? (
              <CommandGroup heading="Tasks">
                {results.tasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`task-${task.id}`}
                    onSelect={() =>
                      go(task.href, {
                        type: 'task',
                        label: task.title,
                        sub: task.appName,
                        href: task.href,
                      })
                    }
                  >
                    <SquareKanban />
                    <span className="truncate">{task.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{task.appName}</span>
                    <StatusDot status={task.status} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.sprints.length > 0 ? (
              <CommandGroup heading="Sprints">
                {results.sprints.map((sprint) => (
                  <CommandItem
                    key={sprint.id}
                    value={`sprint-${sprint.id}`}
                    onSelect={() =>
                      go(sprint.href, {
                        type: 'sprint',
                        label: sprint.name,
                        sub: sprint.appName,
                        href: sprint.href,
                      })
                    }
                  >
                    <Timer />
                    <span className="truncate">{sprint.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{sprint.appName}</span>
                    <StatusDot status={sprint.status} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.meetings.length > 0 ? (
              <CommandGroup heading="Meetings">
                {results.meetings.map((meeting) => (
                  <CommandItem
                    key={meeting.id}
                    value={`meeting-${meeting.id}`}
                    onSelect={() =>
                      go(meeting.href, {
                        type: 'meeting',
                        label: meeting.title,
                        sub: meeting.appName ?? undefined,
                        href: meeting.href,
                      })
                    }
                  >
                    <CalendarDays />
                    <span className="truncate">{meeting.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {meeting.appName ?? format(meeting.startsAt, 'MMM d')}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {createActions.length > 0 ? (
              <CommandGroup heading="Create">
                {createActions.map((action) => (
                  <CommandItem
                    key={action.href}
                    value={`create-${action.href}`}
                    onSelect={() => go(action.href)}
                  >
                    <Plus />
                    {action.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {pages.length > 0 ? (
              <CommandGroup heading="Go to">
                {pages.map((page) => (
                  <CommandItem
                    key={page.href}
                    value={`page-${page.href}`}
                    onSelect={() => go(page.href)}
                  >
                    <page.icon />
                    {page.label}
                    {page.shortcut ? <CommandShortcut>{page.shortcut}</CommandShortcut> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {themeActions.length > 0 || showSignOut ? (
              <CommandGroup heading="Commands">
                {themeActions.map((action) => (
                  <CommandItem
                    key={action.value}
                    value={`theme-${action.value}`}
                    onSelect={() => {
                      setTheme(action.value)
                      setOpen(false)
                    }}
                  >
                    <action.icon />
                    {action.label}
                  </CommandItem>
                ))}
                {showSignOut ? (
                  <CommandItem
                    value="sign-out"
                    onSelect={() => {
                      setOpen(false)
                      void signOutFromPalette()
                    }}
                  >
                    <LogOut />
                    Sign out
                  </CommandItem>
                ) : null}
                {!q || 'toggle go-to shortcuts keyboard'.includes(q) ? (
                  <CommandItem
                    value="toggle-go-shortcuts"
                    onSelect={() => {
                      try {
                        const off = window.localStorage.getItem(GO_SHORTCUTS_KEY) === 'off'
                        window.localStorage.setItem(GO_SHORTCUTS_KEY, off ? 'on' : 'off')
                        toast.info(off ? 'Go-to shortcuts enabled' : 'Go-to shortcuts disabled')
                      } catch {
                        /* localStorage unavailable — shortcuts stay on */
                      }
                      setOpen(false)
                    }}
                  >
                    <Keyboard />
                    Toggle go-to shortcuts (g + key)
                  </CommandItem>
                ) : null}
              </CommandGroup>
            ) : null}
          </CommandList>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-2xs text-muted-foreground">
            <span>
              <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd> open
            </span>
            <span className="hidden sm:inline">
              <kbd className="rounded border bg-muted px-1 font-mono">g</kbd>+key jump
            </span>
            <span className="ml-auto inline-flex items-center gap-1">
              <PawPrint className="size-3" aria-hidden /> LogPup
            </span>
          </div>
        </Command>
      </CommandDialog>
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
      <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-2xs leading-none">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  )
}
