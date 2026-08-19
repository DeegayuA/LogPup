# Command Center & Universal Search — Registry Design Spec

Date: 2026-08-19 · Branch: main (shared worktree) · Status: draft

Supersedes the Architecture notes for this surface in
`docs/superpowers/specs/2026-08-11-ui-redesign-design.md:43-61`, which designed the palette but
not how it stays current.

## Purpose

Today the ⌘K palette is a 760-line client component that hardcodes every group, every
literal and every per-entity render branch (`src/features/search/components/command-center.tsx`),
and universal search is five hand-written Drizzle queries in one function
(`src/features/search/actions.ts:42-143`). Adding a feature means editing both files, and
nobody does — the palette has **already drifted** from the nav registry that shipped after it:

| Drift | Evidence |
| --- | --- |
| Sidebar advertises a `G W` jump for Work log; the palette has no `w` key | `src/components/shell/nav-items.ts:29` vs `command-center.tsx:102-107` |
| Palette's Go-to list omits Work log and Settings | `command-center.tsx:368-378` |
| Palette adds Profile, which nav-items does not have | `command-center.tsx:374` |
| `getVisibleNavItems` — the seam built for exactly this — has zero production callers | `src/components/shell/nav-items.ts:43`; only its own test calls it |

This spec replaces both hardcoded surfaces with a registry that each feature contributes to
from its own directory, and makes forgetting to contribute a **test failure** rather than a
silently missing row.

## Non-goals

- No new dependencies, no schema change, no migration.
- No cross-provider relevance ranking (see **Rejected**).
- No row-level visibility model. Search is workspace-wide today for every approved member
  (`actions.ts:42-116` never reads `session.user.role` after the sign-in check). The registry
  does not change that; it does add the seam where a future scope filter would hang.

## Architecture — two planes, one id space

The single most important constraint is the server/client boundary, and it is **bimodal and
silent** in this repo:

- A client-reachable module that transitively imports `@/db` or any `queries.ts` **compiles
  clean** and ships ~245 KB minified / ~71 KB gzip of drizzle + Neon + the 928-line schema
  into first-load JS — measured with the repo's own esbuild. `CommandCenterProvider` wraps the
  entire `(app)` layout (`src/app/(app)/layout.tsx:28`), so that cost lands on every authed page.
- A client-reachable module that touches `@/lib/auth`, `@/lib/password`, `@/lib/crypto` or
  `next/headers` **hard-fails** the build on `node:crypto`.
- Importing a `'use server'` actions module from a client module is **safe** — Next resolves it
  in a server-only webpack layer and emits a client-reference stub. `command-center.tsx:45-50`
  already does this.

So one registry cannot hold both commands and search queries. There are two:

```
src/features/<feature>/commands.ts          ← CLIENT plane. Directive-less .ts.
src/features/<feature>/search-providers.ts  ← SERVER plane. Directive-less .ts.

src/features/search/registry/types.ts         ← shared types, imported by both planes
src/features/search/registry/commands.ts      ← explicit import list → ALL_COMMANDS
src/features/search/registry/providers.ts     ← explicit import list → ALL_PROVIDERS
src/features/search/registry/registry.test.ts ← the drift guard
```

`registry/commands.ts` is imported by the palette (client). `registry/providers.ts` is imported
only by `src/features/search/actions.ts` (`'use server'`). They share nothing but `types.ts`
and stable string ids.

**Why not one barrel with `export *`:** `src/` contains zero `export * from` today, and a barrel
that re-exported server actions would drop them out of the server-only webpack layer that makes
the current client→action import legal.

**Why not codegen:** a generated barrel is a merge-conflict magnet on a branch four sibling
worktrees are writing to, and its "is the generated file stale" test is a second thing to keep
honest. An explicit import list is 19 lines, greppable, and the drift test compares it against
the directory listing directly.

## Types

`src/features/search/registry/types.ts` — no runtime imports beyond types, so it is importable
from both planes and from a node-environment test.

```ts
import type { ComponentType } from 'react'
import type { Session } from 'next-auth'

/** What the palette knows about the caller. Presentation only — see the note below. */
export type PaletteContext = {
  user: Session['user']
}

export type CommandGroupId =
  | 'task'      // the natural-language quick-assign preview
  | 'recent'
  | 'result'    // search hits, ordered by their provider's rank
  | 'create'
  | 'navigate'
  | 'command'

export type CommandDescriptor = {
  /** Stable, globally unique. Becomes the cmdk `value`, so it is also the selection identity. */
  id: string
  label: string
  /** Extra substrings the label does not contain. Matching is label-or-keyword, case-insensitive. */
  keywords?: string[]
  group: CommandGroupId
  icon: ComponentType<{ className?: string }>
  /** Rendered as a CommandShortcut badge. Derive it — never type "G W" twice. */
  shortcut?: string
  /** Single-key jump after `g`. Lower-cased on read; must be unique across the registry. */
  goKey?: string
  /**
   * PRESENTATION ONLY. Hiding a command is not a permission check — every server action
   * re-gates on the server (see src/features/admin/actions.ts:391). Return false to declutter,
   * never to secure.
   */
  visible?: (ctx: PaletteContext) => boolean
} & (
  | { href: string; run?: never }
  | { href?: never; run: (api: CommandApi) => void | Promise<void> }
)

/** What a `run` command may do. Deliberately small — no router, no db, no session. */
export type CommandApi = {
  /** Closes the palette, records a recent when given one, then router.push. */
  go: (href: string, recent?: PaletteRecent) => void
  close: () => void
  /** Clears both module-level dedupers. MUST be called by any command that writes. */
  invalidateSearch: () => void
}

export type PaletteRecent = {
  type: 'app' | 'person' | 'task' | 'sprint' | 'meeting' | 'page'
  label: string
  sub?: string
  href: string
}

/** One row in the palette's results list, from any provider. */
export type SearchHit = {
  id: string
  title: string
  subtitle?: string
  href: string
  /** Drives the status dot; unknown values fall back to `bg-border`. */
  status?: string
  recentType: PaletteRecent['type']
}

export type SearchProvider = {
  id: string
  /** Group heading, e.g. "Apps". */
  label: string
  icon: ComponentType<{ className?: string }>
  /** Group order in the list. Lower first. Existing order: apps 10, people 20, tasks 30, sprints 40, meetings 50. */
  rank: number
  /**
   * Runs its OWN hand-written Drizzle query. It must read the live_* subqueries from
   * '@/db/live' for any soft-deleted table, and it owns its own ORDER BY and LIMIT —
   * see "Providers are functions, not table descriptors" below for why this is not
   * expressed as data.
   */
  search: (query: string, ctx: PaletteContext) => Promise<SearchHit[]>
}
```

### Providers are functions, not table descriptors

A `{ table, columns, orderBy }` descriptor was the obvious shape and it is wrong here, for four
independent reasons — each one alone is disqualifying:

1. **It blinds the soft-delete guard.** `src/db/live.test.ts` is a *regex source scan* for
   `.from(tasks)` / `innerJoin(meetings, …)` / `alias(sprints, …)`. If tables live in a data
   structure and the registry calls `.from(entry.table)` generically, the scan sees nothing and
   the repo's only defence against resurfacing trashed rows goes quietly blind.
2. **Drizzle rejects it.** `src/db/live.ts:11-16` records that a generic helper was already
   tried and abandoned: `.from()`'s signature is a conditional type a generic parameter cannot
   satisfy, and per-table builders are what give consumers `liveMeetings.startsAt` instead of a
   union.
3. **The five entities are not uniform.** No join for apps/users, `innerJoin` for tasks/sprints,
   `leftJoin` for meetings (nullable `appId`, `schema.ts:288`); apps matches a raw
   `array_to_string(techTags, ' ') ILIKE` expression no column list can express; ordering is
   `asc(status)` for three (meaningful only via pg enum declaration order) and
   `desc(startsAt)` for meetings.
4. **It leaks.** `users.email` is *searched* but deliberately not *projected*
   (`actions.ts:65` vs `:72`). A descriptor that derives the SELECT list from the searchable
   columns puts every teammate's email into a client component's props. Likewise
   `and(eq(users.active, true), eq(users.status, 'approved'))` looks like an ordinary predicate
   but is the **only** thing hiding deactivated, pending and rejected accounts.

So each provider is a function containing a literal query, colocated with the feature that owns
the table. The registry supplies iteration, not SQL.

### Concurrency

`universalSearch` fans out in one `Promise.all` and must keep doing so:

```ts
const hits = await Promise.all(providers.map((p) => p.search(query, ctx).catch(() => [])))
```

A `for … await` loop would turn one batched request into N sequential Neon HTTP round trips.
Per-provider `.catch(() => [])` means one broken provider degrades its own group instead of
emptying the palette.

## Permissions

There is no shared authorization helper to plug into: `requireAdmin()` is a private
copy-paste in **seven** files, and `canManageMeeting` exists twice with incompatible signatures.
This spec does **not** unify them — that is the RBAC work already specced in
`docs/superpowers/specs/2026-08-19-admin-rbac-design.md`.

What it does instead:

- `visible(ctx)` is a free predicate, not an `adminOnly: boolean`. A boolean flag cannot express
  `updateApp` (admin **or** app manager), `updateTask` (admin **or** assignee), `resolveFollowup`
  (admin **or** creator **or** subject), or anything behind `canManageMeeting`.
- Its docstring states in the type itself that it is presentation only.
- Commands needing an entity id are simply **not registered**. Roughly 90 of ~120 exported
  actions require a `meetingId`/`taskId`/`appId`; the five `purge*` actions additionally take a
  literal confirm phrase, and three take `FormData`. Those are row actions, not palette commands.
- `requestLiveToken` stays out: it is behind `isLiveTranscriptionEnabled()` *and* a permission
  gate, and a registry with only a permission dimension would show a command that always errors.

## Behavior preservation

The registry replaces **data**, not the palette's machinery. These stay as they are:

| Machinery | Why it must not move |
| --- | --- |
| Two module-scope dedupers, 30 s TTL (`command-center.tsx:81-83`) | Module scope is deliberate — they survive dialog remounts, which is when a repeat query is most likely. |
| `invalidateSearch` on every writing command | Only `quickAssignTask` clears them today; each new write command inherits the obligation or serves a pre-write view for 30 s. |
| Two independent sequence refs, two debounces (180 ms), two minimum lengths (2 for search, 4 for intent) | Different thresholds are intentional; a single global threshold is a behavior change. |
| `shouldFilter={false}` + per-item matching | Re-enabling cmdk scoring would double-filter and pull the `app-`/`page-` value prefixes into the match text. |
| `intentProps` on entity + recent rows only | Applying it to every row turns an idle arrow-key sweep through Go-to/Commands into a prefetch storm. |
| Both `g`-prefix state machines, 800 ms each | The global one consumes the prefix on an invalid second key; the in-palette one restores the swallowed `g` as `g<char>` or bare `g`. Collapsing them changes what typing `g` then `o` does. |
| `CommandItem` child order | `src/components/ui/command.tsx:170` injects a trailing `CheckIcon` suppressed only by a `data-slot=command-shortcut` descendant; `StatusDot` competes for the same `ml-auto` slot. |

### Intentional behavior changes

Called out because they are user-visible, not incidental:

1. **`G W` starts working** and Work log + Settings appear in Go-to — the nav group is seeded
   from `getVisibleNavItems(isAdmin)` + `settingsNavItem`, and `goKey` comes from `NavItem.key`,
   so the sidebar's advertised hint and the palette's binding cannot diverge again.
2. **Matching is unified** to label-or-keyword substring. Today four different semantics exist;
   `'theme'.includes(q)` currently surfaces all three theme actions for the query `the`, and
   `'sign out log out'.includes(q)` matches mid-phrase junk like `out l`. Both become keyword
   matches (`keywords: ['theme', 'appearance']`, `['sign out', 'log out']`).
3. **Recents honour `type`** — the stored shape already carries it and nothing reads it
   (every recent renders `<Search />`). Existing `logpup.recents.v1` entries stay valid; the
   icon just stops being generic.

## The drift guard

`src/features/search/registry/registry.test.ts`, modelled on `src/db/live.test.ts` — the house
pattern for enforcement-by-source-scan. Non-negotiable details, each learned from that file:

- **`.test.ts`, never `.test.tsx`.** `vitest.config.ts:9` includes only `src/**/*.test.ts`; a
  `.tsx` test is silently never run — green forever with zero tests executed.
- **Node environment.** No jsdom is installed. The registry modules must therefore stay free of
  `window`/`localStorage`/cmdk at module scope, which is exactly why `commands.ts` files are
  plain `.ts` holding data, like `nav-items.ts`.
- **`__dirname` anchoring**, not `process.cwd()` — the latter breaks when vitest is invoked from
  a worktree subdirectory.
- **Hand-rolled `readdirSync` walk.** No glob library is a declared dependency; `glob`,
  `fast-glob` and `tinyglobby` exist only transitively and importing one is a phantom dependency.
- **An explicit `it('no offenders')` branch.** A `describe()` whose only tests come from
  `it.each(offenders)` fails the whole file with "No test found in suite" the moment the list is
  empty — i.e. exactly when the refactor succeeds.
- **Allowlist hygiene.** Every exemption carries a `// why:` comment and is asserted to still
  exist on disk, so a rename fails loudly instead of widening the exemption silently.

Checks:

| # | Check | Failure message points at |
| --- | --- | --- |
| 1 | Every `src/features/<feature>/` either has `commands.ts` or is in `NO_COMMANDS` | the feature dir |
| 2 | Every `commands.ts` on disk is imported by `registry/commands.ts` | the orphaned file |
| 3 | Every `search-providers.ts` on disk is imported by `registry/providers.ts` | the orphaned file |
| 4 | No `commands.ts` imports `@/db`, `*/queries`, `@/lib/auth`, `@/lib/crypto` or `next/headers` | the offending import |
| 5 | Command ids are unique; `goKey`s are unique | the collision |
| 6 | Every `goKey` command has a matching `shortcut` badge, and vice versa | the half-wired command |
| 7 | Allowlist hygiene: every `NO_COMMANDS` / `NO_SEARCH` entry still exists | the stale entry |

`NO_COMMANDS` starts with the four features that own no actions and no entities — calendar,
dashboard, pwa, settings — each with a `// why:` line. Forcing empty modules on them would make
the registry noise rather than signal.

**Honest limitation, stated rather than lived with:** there is no CI in this repo — no
`.github`, no yml, no git hooks. `src/db/live.test.ts` already calls itself "the actual CI
enforcement", which is currently not true of anything. This guard runs when a human or an agent
runs `npm test`. That is why the skill instruction below exists: the agent is the CI.

## Keeping it current when a feature is added (the Claude-skills half)

Three layers, in the order a future session encounters them:

1. **The registry module's doc comment** — the teacher. `registry/commands.ts` opens with the
   same shape of header `nav-items.ts:20-23` uses: what this is the single source of truth for,
   which surfaces map over it, and what happens if you skip it.
2. **The drift test** — the enforcer. Named in the failure message so the fix is self-service.
3. **One line in `.claude/skills/logpup-development/SKILL.md`** — the pointer. Deliberately one
   line: that skill's own charter (`SKILL.md:8`) says it carries only cross-session process and
   history, and defers in-code conventions to "the enforcement tests and file headers". A
   paragraph there would be the exact bloat the file warns against. `.claude/skills/**` is also
   the only agent-instruction path that is committed — `.gitignore:59-60` ignores `.claude/*`
   except skills, and `AGENTS.md`/`CLAUDE.md` are machine-rewritten by `next dev`.

## Build order

Each step leaves the tree green and is a small, explicitly-staged commit — four sibling
worktrees are live and the skill bans `git add -A`, `stash`, `reset --hard` and `checkout -- .`.

1. `registry/types.ts` + `registry/commands.ts` seeded from nav-items and the palette's current
   literals. No consumer yet.
2. `registry/registry.test.ts` with checks 1-7. Red until step 4 lands, by design.
3. Per-feature `commands.ts` for the features that have real palette-shaped commands; the four
   no-action features go into `NO_COMMANDS`.
4. `command-center.tsx` reads the registry; delete its literal arrays. Machinery untouched.
5. `search-providers.ts` per searchable feature, holding today's exact queries verbatim.
6. `registry/providers.ts` + `universalSearch` iterating providers in one `Promise.all`.
7. The SKILL.md pointer line.

## Testing

- `registry.test.ts` — the seven checks above.
- `registry/commands.test.ts` — pure assertions on derived views, asserting on `href`/`label`/`id`
  and **never on whole objects** (icons are component identities; `nav-items.test.ts:8-13` sets
  the precedent).
- `search-providers` — each provider's query is built through the connection-free `QueryBuilder`
  in a `toSQL()` assertion, the way `live.test.ts` proves `liveMeetings` emits
  `deleted_at is null`. That is the only way to unit-test SQL here without a database.
- Existing suites must stay at 123 files / 2059 tests passing, and `npx tsc --noEmit` clean.
  Lint has 3 pre-existing errors, all `react-hooks/set-state-in-effect` in meetings components;
  the new code must not add a fourth — recents load through a `useState` initializer, not an effect.

## Rejected

- **Cross-provider relevance ranking.** Each bucket is capped at 6 rows and ordered by pg enum
  declaration order. Replacing that with a global relevance sort changes *which* rows survive the
  LIMIT, not just their order — a silent result-set change with no test covering it (there is no
  test file under `src/features/search/` at all).
- **`adminOnly: boolean`.** Misrepresents at least five real permission rules; see **Permissions**.
- **A generated barrel / codegen step.** Conflict-prone on a shared branch and adds a
  staleness check that itself has to be kept honest.
- **Routing every provider through `live*`.** There is no `liveApps`/`liveUsers` and there must
  not be: neither table has a `deletedAt` column, and `live.test.ts` asserts `SOFT_TABLES`
  contains exactly five entries.
- **Registering every exported server action.** ~90 of ~120 need an entity id a bare palette
  query does not carry.

## Assumptions (delegated decisions — veto here)

1. `G W` starting to work, and Work log + Settings appearing in Go-to, is desired. This is the
   drift being fixed, but it is user-visible.
2. Profile stays in the palette even though it is not a sidebar nav item.
3. `import 'server-only'` is **not** added to `src/db/index.ts` in this change. It would convert
   the silent 245 KB client-bundle leak into a build error and is one line, but it touches a file
   outside this feature and every module that transitively imports it — worth doing, separately.
4. Meeting hits keep linking to the bare `/meetings` list, because no `/meetings/[id]` route
   exists. Not this spec's job to add one.
5. The pre-existing task-href bug is preserved, not fixed here: a live task whose sprint was
   trashed links to `?sprint=<trashed-id>`, which the board silently falls back to the active
   sprint. Fixing it is a one-line change in the tasks provider and should be its own commit.
