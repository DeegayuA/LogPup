# Command Center & Universal Search — Registry Design Spec

Date: 2026-08-19 · Branch: main (shared worktree) · Status: **built** — the tree matches this
document. Verified at the time of writing: `npx tsc --noEmit` clean, `npx vitest run` 128 files /
2144 tests passing, `npm run lint` unchanged from its pre-existing 3 errors (all
`react-hooks/set-state-in-effect` in meetings components, none in this work).

A parallel session was editing `command-center.tsx` throughout. Its work is kept, not reverted:
the `GO_TARGETS` derivation from `navItems`, the `key: 'V'` for Activity, the single
`goShortcutsEnabled()` read that closed the in-palette opt-out gap, the state-naming toggle
label, the natural-language placeholder, and the `hidden sm:inline` on jump chips. The one edit
of theirs this supersedes is the hand-written Work log row in `pages` — destinations are derived
now, so that row appears without anyone adding it.

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
src/features/search/registry/commands.ts      ← explicit import list → paletteCommands(ctx, q)
src/features/search/registry/providers.ts     ← explicit import list → runProviders(q, ctx)
src/features/search/registry/kinds.ts         ← CLIENT. icon + mono face per result kind
src/features/search/registry/limits.ts        ← shared constants + likePattern()
src/features/search/registry/registry.test.ts ← the drift guard
```

`kinds.ts` exists because a provider runs on the server and **a React component cannot come back
across that boundary** — passing one would throw "Functions cannot be passed directly to Client
Components" at runtime, not at build time. So a hit says what *kind* of thing it is and the client
decides how a kind looks. That table is also what finally makes recents render their own icons:
the stored `type` has been there all along with nothing reading it.

**A command module must import its server actions lazily.** `await import('…/actions')` inside
`run`, never a static import at the top. This is not style: a static import pulls `next-auth` into
the module graph of everything that reads the registry, and the first thing that breaks is the
drift test, which runs in a plain node environment. Found by the guard failing on its own first
run — `Cannot find module 'next/server' imported from next-auth/lib/env.js`.

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
| 4 | Every feature either has a `search-providers.ts` or is in `NO_SEARCH` | the feature dir |
| 5 | No `commands.ts` imports `@/db`, a `queries` module, a server-only lib or `next/headers` | the offending import |
| 5b | No `'use client'` file anywhere in `src/` value-imports the provider plane | the offending file |
| 6 | Command ids are unique and namespaced; provider ids unique and no two ranks tie | the collision |
| 7 | Allowlist hygiene: every entry still exists, and none has since gained the file it was exempt from | the stale entry |

Check 5b is the mirror of check 5 and closes the hazard check 5 alone does not: `commands.ts`
files are not the only thing that can import the server plane. `CommandCenterProvider` wraps the
whole `(app)` layout, so a single value-import of `registry/providers` from any client module puts
drizzle, the Neon driver and the whole schema in the first-load JS of every authed page — and
compiles clean while doing it. `import type` is exempt; types are erased.

Plus eleven behavioural assertions on what the registry resolves to — that a member sees neither
`/admin` nor "New app" and an admin sees both, that a jump chip appears only while the jumps are
switched on, that Work log and Settings are offered at all, that the current theme is hidden, that
the shortcuts row names the state it will move you to, that `log out` finds Sign out while the
seam-spanning `out l` no longer does, and that Create sorts above destinations above Commands.

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

## A security fix that came with it

`universalSearch` gated on "has a session". Open signup means a **pending** account holds a real
session while it waits for an admin, and the proxy only pins those users to `/pending` — a server
action is its own entry point and can be called without loading a page the proxy guards. So an
unapproved or deactivated account could enumerate every app, person, task, sprint and meeting in
the workspace, one query at a time.

It now gates on `canAccessApp(session.user.status, true)` — the same predicate the proxy and the
ICS route use. Every provider inherits it; none re-checks it, which is stated on `SearchContext`
so the next provider author does not add a second, weaker gate.

This bug predates the registry. It is fixed here because the registry rewrote exactly that line,
and shipping a refactor that faithfully preserves a hole is not preservation.

## What shipped

1. `registry/types.ts`, `kinds.ts`, `limits.ts` — the contracts.
2. `registry/commands.ts` — destinations derived from `navItems` + `settingsNavItem` +
   `adminNavItems`, feature commands appended, one matching rule, one group order.
3. `commands.ts` for apps, auth, meetings, notifications, people, settings. The other thirteen
   features are in `NO_COMMANDS` with a reason each.
4. `search-providers.ts` for apps, people, sprints (tasks + sprints) and meetings, holding the
   previous queries verbatim — same tables, same joins, same ordering, same limit of 6.
5. `registry/providers.ts` — one `Promise.all`, per-provider `.catch(() => [])`.
6. `universalSearch` reduced to an auth gate plus `runProviders`.
7. `command-center.tsx` renders two loops instead of ten hardcoded groups. Its keyboard model,
   dedupers, debounces, sequence guards and prefetch wiring are untouched.
8. `registry.test.ts` — the guard, proven to fail: adding an unregistered feature directory turned
   checks 1 and 4 red with the fix named in the message, and removing it turned them green.
9. One line in `.claude/skills/logpup-development/SKILL.md`.

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

## Known limitations (stated, not hidden)

1. **The guard runs on `npm test`, and nowhere else.** There is no CI in this repo — no
   `.github`, no yml, no git hooks. Worth knowing before "fixing" it with a `prebuild` script:
   that would not work either, because `vercel.json` sets `buildCommand: "next build"`, which
   invokes the Next binary directly and never fires an npm lifecycle hook. (The proof is already
   in the tree: `src/lib/changelog.data.json` is generated by `prebuild` and committed, precisely
   because Vercel never regenerates it.) Real enforcement needs either
   `"buildCommand": "npm run build"` or a workflow file — both change how deploys behave, so
   neither is done here without asking.
2. **The soft-delete scan is file-scoped, inherited from `src/db/live.test.ts`.** A provider
   colocated in `meetings/search-providers.ts` could read a meeting child table with no liveness
   join and satisfy every guard, because the file already names `liveMeetings`. Statement-scoping
   it means resolving each read root back to its binding — worth doing, not done here.
3. **Check 5 is one level deep.** It reads each `commands.ts`, not what those files import. A
   command module importing a local helper that imports `@/db` still ships drizzle to the
   browser. The durable fix is `import 'server-only'` in `src/db/index.ts`, which converts the
   silent 245 KB regression into a build error — with the caveat that `server-only` is not in
   `package.json` and `registry.test.ts` imports the provider plane at runtime, so that commit
   needs a vitest alias in the same change.
4. **Every provider is workspace-wide.** There is no row-scoping seam, because there is no
   row-level visibility anywhere in the app today. The first per-user provider (a notifications
   inbox, someone's worklogs) needs a `scope` field on `SearchProvider` and a check that an
   `own-rows` provider actually references `ctx.user.id` — otherwise it will be written
   workspace-wide by default, and nothing will notice.

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
   drift being fixed, but it is user-visible. (The `G W` half landed in the parallel session; the
   Go-to rows land here.)
2. Profile stays in the palette even though it is not a sidebar nav item — it now belongs to the
   auth feature, which is the thing that owns your account.
3. `import 'server-only'` is **not** added to `src/db/index.ts` in this change. It would convert
   the silent 245 KB client-bundle leak into a build error and is one line, but it touches a file
   outside this feature and every module that transitively imports it — worth doing, separately.
4. Meeting hits keep linking to the bare `/meetings` list, because no `/meetings/[id]` route
   exists. Not this spec's job to add one.
5. The pre-existing task-href bug is preserved, not fixed here: a live task whose sprint was
   trashed links to `?sprint=<trashed-id>`, which the board silently falls back to the active
   sprint. Fixing it is a one-line change in the tasks provider and should be its own commit.
