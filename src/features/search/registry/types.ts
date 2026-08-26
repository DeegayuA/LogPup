import type { ComponentType } from 'react'
import type { Session } from 'next-auth'
import type { Accent, Theme } from '@/components/shell/theme-provider'
import type { SidebarState } from '@/components/shell/sidebar-model'

/**
 * The shapes every feature fills in to appear in the command center.
 *
 * Type-only imports, so this module is safe on BOTH sides of the boundary:
 * `commands.ts` files reach it from the client palette, `search-providers.ts`
 * files reach it from the server action, and the drift test imports it in a
 * node environment with no DOM. Nothing runtime may be added here.
 */

/**
 * What a search provider is told about the caller.
 *
 * Only the session: a provider runs on the server, and the shell state below
 * would be meaningless there. Keeping it separate also keeps the client from
 * shipping the palette's UI state to the database layer on every keystroke.
 */
export type SearchContext = {
  user: Session['user']
}

/**
 * What the palette knows when it decides which rows to show.
 *
 * `user` is presentation only — see `visible`. The shell fields are here
 * so a row can NAME the state it will leave you in ("Turn off go-to
 * shortcuts") instead of the verb "toggle"; without them those rows could not
 * live in a feature module and would have to stay hardcoded in the palette,
 * which is the drift this registry exists to end.
 */
export type PaletteContext = SearchContext & {
  theme: Theme
  /** Which colourway is on, so the row for it can hide itself. */
  accent: Accent
  goShortcutsOn: boolean
  /**
   * Whether the desktop sidebar is wide or an icon rail, so its row can say
   * which way it will move you. Same reason the two fields above are here.
   */
  sidebar: SidebarState
}

export type CommandGroupId =
  /** Destinations. Rendered under "Go to". */
  | 'navigate'
  /** Things that make a new row somewhere. Rendered under "Create". */
  | 'create'
  /** Everything else the palette can do to the app itself. */
  | 'command'

/** A recent, as persisted in `logpup.recents.v1`. */
export type PaletteRecent = {
  type: 'app' | 'person' | 'task' | 'sprint' | 'meeting' | 'page'
  label: string
  sub?: string
  href: string
}

/**
 * What a `run` command is handed. Deliberately small: no router, no session,
 * no db. A command that needs more than this is a page, not a palette row.
 */
export type CommandApi = {
  /** Closes the palette, records a recent when given one, then navigates. */
  go: (href: string, recent?: PaletteRecent) => void
  close: () => void
  /** The shell's own switches, so appearance rows are feature-owned like the rest. */
  setTheme: (theme: Theme) => void
  setAccent: (accent: Accent) => void
  setGoShortcuts: (on: boolean) => void
  setSidebar: (state: SidebarState) => void
  /**
   * Drops every retained search answer. Any command that WRITES must call
   * this: the palette caches results for 30s (see the deduper comment in
   * components/command-center.tsx), so a create/toggle/resolve that skips it
   * keeps serving a pre-write view of the workspace for the rest of the TTL.
   */
  invalidateSearch: () => void
}

type CommandBase = {
  /**
   * Stable and globally unique. Becomes the cmdk `value`, which is also the
   * selection identity — changing an id resets which row is highlighted, so
   * treat it as an API, not a label.
   */
  id: string
  /**
   * A function only when the row's wording depends on live state — a switch
   * should say which way it will move you, not "toggle". Both forms are
   * matched against the query identically.
   */
  label: string | ((ctx: PaletteContext) => string)
  /**
   * Extra words that should match this row but do not appear in the label.
   * Matching is substring, case-insensitive, against the label and each
   * keyword — one rule for every static row.
   */
  keywords?: string[]
  group: CommandGroupId
  icon: ComponentType<{ className?: string }>
  /** Chip on the right of the row, e.g. "G W". Derive it; never type it twice. */
  shortcut?: string
  /**
   * PRESENTATION ONLY. Hiding a row is not a permission check — the server
   * action re-gates on every call, and features/admin/actions.ts says as much
   * about its own UI. Return false to declutter a palette, never to secure an
   * action.
   */
  visible?: (ctx: PaletteContext) => boolean
}

/** Navigates. The palette records a recent and pushes the route. */
export type HrefCommand = CommandBase & { href: string; run?: never }

/**
 * Does something. Gets the small api above plus the same context the label
 * and `visible` see, so a switch can act on the state it just described.
 */
export type RunCommand = CommandBase & {
  href?: never
  run: (api: CommandApi, ctx: PaletteContext) => void | Promise<void>
}

export type CommandDescriptor = HrefCommand | RunCommand

/** One row in the results list, whichever provider produced it. */
export type SearchHit = {
  id: string
  title: string
  subtitle?: string
  href: string
  /** Feeds the status dot. Unknown values fall back to a neutral dot. */
  status?: string
  /** Which icon the row wears, and what kind of recent it becomes when opened. */
  kind: PaletteRecent['type']
}

/** One group of results, as the palette renders it. */
export type SearchGroup = {
  providerId: string
  label: string
  hits: SearchHit[]
}

/**
 * A provider carries NO icon and no styling. Both live in registry/kinds.ts on
 * the client, because a provider runs on the server and a React component
 * cannot cross that boundary — passing one back would throw "Functions cannot
 * be passed directly to Client Components" at runtime, not at build time. A
 * hit says what KIND of thing it is; the client decides how a kind looks.
 */
export type SearchProvider = {
  id: string
  /** Group heading, e.g. "Apps". */
  label: string
  /** Group order in the list, lower first. Today: apps 10 … meetings 50. */
  rank: number
  /**
   * Runs its OWN hand-written query, colocated with the feature that owns the
   * table.
   *
   * DO NOT refactor this into `{ table, columns }` descriptors, and do not
   * hoist the tables of an existing provider into a config object either. Not
   * a style preference — doing it DISABLES the repo's soft-delete guard, and
   * disables it silently, on a green test run.
   *
   * Why: db/live.test.ts enforces soft deletes by REGEX-SCANNING source for
   * reads of a soft-deleted table by name. It can only see a table it can read
   * as a literal. Select through a variable instead and the scan matches
   * nothing, reports no offenders, and passes — while the read it was meant to
   * catch is now unguarded. The failure mode is a trashed meeting or task
   * reappearing in ⌘K while the admin trash still lists it as deleted.
   *
   * So: write the query out, and read soft-deleted tables through the live_*
   * subqueries in db/live.ts.
   *
   * SECOND TRAP, same shape — the code reads correct and the SQL is not.
   * Drizzle drops table qualifiers across the whole select list when the outer
   * query is SINGLE-TABLE, so a correlated subquery loses the qualification its
   * predicate depends on: `meetingApps.meetingId = liveMeetings.id` rendered as
   * `"meeting_id" = "id"` and bound to the INNER table's id, comparing a
   * meeting uuid against an app uuid. It typechecks, it lints, it returns rows,
   * and the group silently showed dates where project names belonged. Real
   * joins flip isSingleTable off and restore qualification; a GROUP BY then
   * keeps LIMIT meaning six meetings rather than six meeting-project pairs.
   * Prefer joins plus grouping over a correlated subquery here — and if you
   * must correlate, render the SQL and read it.
   *
   * (Written without naming those tables in code form on purpose: the scan
   * reads comments too, and a doc comment that demonstrates the offence is
   * indistinguishable from committing it.)
   */
  search: (query: string, ctx: SearchContext) => Promise<SearchHit[]>
}
