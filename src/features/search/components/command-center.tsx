'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  AppWindow,
  CalendarDays,
  LayoutDashboard,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  PawPrint,
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
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { universalSearch, signOutFromPalette, type SearchResults } from '../actions'

type Recent = {
  type: 'app' | 'person' | 'task' | 'sprint' | 'page'
  label: string
  sub?: string
  href: string
}

const RECENTS_KEY = 'logpup.recents.v1'
const EMPTY_RESULTS: SearchResults = { apps: [], people: [], tasks: [], sprints: [] }

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

const STATUS_DOT: Record<string, string> = {
  active: 'bg-primary',
  planned: 'bg-chart-1',
  paused: 'bg-chart-1',
  done: 'bg-muted-foreground/40',
  archived: 'bg-muted-foreground/40',
  todo: 'bg-muted-foreground/40',
  in_progress: 'bg-chart-1',
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      aria-hidden
      className={cn('ml-auto size-1.5 shrink-0 rounded-full', STATUS_DOT[status] ?? 'bg-border')}
    />
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
  const [recents, setRecents] = React.useState<Recent[]>([])
  const searchSeq = React.useRef(0)
  const goPrefix = React.useRef<number | null>(null)

  /* ⌘K / Ctrl+K opens; "g then d/a/p/m" jumps between sections. */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      if (goPrefix.current !== null && Date.now() - goPrefix.current < 800) {
        const href = GO_KEYS[event.key]
        goPrefix.current = null
        if (href) {
          event.preventDefault()
          router.push(href)
        }
        return
      }
      if (event.key === 'g') goPrefix.current = Date.now()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router])

  React.useEffect(() => {
    if (open) {
      setRecents(readRecents())
      setQuery('')
      setResults(EMPTY_RESULTS)
    }
  }, [open])

  /* Debounced server search; stale responses are dropped by sequence id. */
  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
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

  const showSignOut = !q || 'sign out log out'.includes(q)
  const hasEntityResults =
    results.apps.length > 0 ||
    results.people.length > 0 ||
    results.tasks.length > 0 ||
    results.sprints.length > 0
  const nothingAtAll =
    q.length >= 2 && !searching && !hasEntityResults && pages.length === 0 && themeActions.length === 0

  const contextValue = React.useMemo(() => ({ setOpen }), [])

  return (
    <CommandCenterContext.Provider value={contextValue}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command center"
        description="Search apps, people, tasks, and sprints, or run a command"
        className="top-[20%] sm:max-w-xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Fetch anything — apps, people, tasks…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {searching ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Sniffing around…
              </div>
            ) : null}
            {nothingAtAll ? (
              <CommandEmpty>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <PawPrint className="size-4" aria-hidden />
                  Nothing to fetch for “{query.trim()}”.
                </span>
              </CommandEmpty>
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
              </CommandGroup>
            ) : null}
          </CommandList>
          <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd> open
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
      <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  )
}
