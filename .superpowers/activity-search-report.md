# /activity real search — implementation report

## Files touched (all within assigned scope)

- `src/features/activity/types.ts` — added `q?: string` to `ActivityFilters`.
- `src/features/activity/filters.ts` — added `activitySearchCondition`, composed it into
  `activityConditions`, added `activityParams`/`ActivityParamState`.
- `src/features/activity/filters.test.ts` — tests for the above.
- `src/features/activity/search.ts` (new) — `rankActivityMatches`, `fuzzyActivityFallback`,
  `activityRowSearchText`.
- `src/features/activity/search.test.ts` (new) — tests for the above.
- `src/features/activity/components/activity-filter-bar.tsx` — added `SearchFilter` input,
  extended `ActivityFilterState`, wired `apply()`/Clear/`anyFilter` to `q`.
- `src/app/(app)/activity/page.tsx` — `q` param parsing, Layer 2 wiring (rank on hit, fuzzy
  fallback on miss), fallback heading, Load-more via `activityParams`.

## Layer 1 — SQL condition shape (`activitySearchCondition`, in `filters.ts`)

```ts
export function activitySearchCondition(q: string): SQL | undefined
```

- Tokenises `q` on whitespace (`q.trim().split(/\s+/).filter(Boolean)`); empty/whitespace-only
  → `undefined` (trail stays unfiltered, never turns empty).
- Every token is required (AND across tokens); each token matches if it appears in **any** of
  `entityLabel`, `detail`, `verb`, `entityType` (OR across columns) — the four text columns that
  actually exist on `activity_log` (checked against `src/db/schema.ts`).
- Each token is escaped (`token.replace(/[\\%_]/g, '\\$&')`, same backslash-escape already used
  in `features/people/queries.ts`) before being wrapped `%…%` and passed to `ilike` — so `%`/`_`
  in a query match literally, not as SQL wildcards.
- Composed into `activityConditions` unconditionally: `activitySearchCondition(filters.q ?? '')`
  as one more `AND`-ed part alongside actor/type/app/date/cursor.

Rendered SQL for `activitySearchCondition('team standup')` (via `PgDialect.sqlToQuery`, the same
dialect the live `db` uses):

```
(("activity_log"."entity_label" ilike $1 or "activity_log"."detail" ilike $2
   or "activity_log"."verb" ilike $3 or "activity_log"."entity_type" ilike $4)
 and
 ("activity_log"."entity_label" ilike $5 or "activity_log"."detail" ilike $6
   or "activity_log"."verb" ilike $7 or "activity_log"."entity_type" ilike $8))
params: ['%team%','%team%','%team%','%team%','%standup%','%standup%','%standup%','%standup%']
```

Escaping check — `activitySearchCondition('50%_off')` → param `'%50\\%\\_off%'` (literal).

## Layer 2 — pure TS contracts (`search.ts`)

```ts
export function rankActivityMatches<T>(rows: T[], q: string, text: (row: T) => string): T[]
```
- Tokenises `q`; empty/whitespace query is a no-op (returns `rows` unchanged, same reference).
- Keeps a row only if its `text()` contains at least one query token verbatim (substring) — true
  by construction for anything Layer 1 already returned, re-checked here defensively.
- Orders survivors by the average, across tokens, of the best per-token `similarity()` (from
  `src/lib/fuzzy.ts`) against any individual word in the row's text — descending, stable on ties.
- Purpose: re-rank Layer 1's SQL-matched rows by relevance instead of leaving them in
  chronological order.

```ts
export function fuzzyActivityFallback<T>(rows: T[], q: string, text: (row: T) => string): T[]
```
- Same tokenisation/scoring as above, but **no substring gate** — a row qualifies purely on
  fuzzy similarity (a misspelling is by definition not a substring match). Threshold `0.65`
  (see comment in `search.ts`: "meetign" vs "meeting" scores ≈0.714; unrelated words score ≈0).
- Empty/whitespace query → `[]` (nothing to be a fuzzy match for).
- Purpose: when Layer 1 finds literally nothing, called by the page over a **bounded**
  (page-size-limited, filters-minus-`q` + same cursor) re-query.

```ts
export function activityRowSearchText(row: ActivityRow): string
```
- `[entityLabel, detail, verb, entityType].filter(Boolean).join(' ')` — deliberately the same
  four columns `activitySearchCondition` searches in SQL, so "match" doesn't drift between the
  two layers.

## Page wiring (`src/app/(app)/activity/page.tsx`)

- `paramsSchema` gained `q: z.string().trim().min(1).optional().catch(undefined)` — whitespace
  and invalid input degrade to "not filtered", same contract as the other params.
- If the primary `listActivity({ filters: {..., q}, cursor })` call returns rows and `q` is set,
  they're re-ranked via `rankActivityMatches` before rendering (flat, not day-grouped — a
  relevance order and a day-bucketed order don't mix).
- If it returns **zero** rows and `q` is set: a second `listActivity` call, same `filters` minus
  `q`, same `cursor`, same `PAGE_SIZE` limit (never unbounded), then `fuzzyActivityFallback` over
  that. If that finds anything, `fallbackActive = true` and an explicit heading renders above the
  feed: `No exact matches — showing close matches for "…".` If it's also empty, the existing
  "Nothing matches these filters." empty state renders — nothing fuzzy is ever presented as exact.
- Load-more link is built via the new `activityParams()` helper (shared with the filter bar's
  `apply()`), keyed off the **primary** (SQL-ordered) page's last row — the fallback/re-ranked
  view has no keyset order to continue from, and `hasMore` (from the primary query) is already
  `false` whenever the fallback is showing, so no Load-more renders there.

## UI (`activity-filter-bar.tsx`)

- New `SearchFilter` component follows the file's existing `DateFilter` idiom: local draft state,
  keyed by the committed value so external navigation (Clear, back button, shared link) remounts
  and resyncs it. Difference from `DateFilter`: debounced via `setTimeout` (400ms) rather than
  committed on blur, since search should feel live while typing, not require leaving the field —
  Enter commits immediately, Escape reverts the draft and cancels the pending commit.
- `apply()` now calls the shared `activityParams()` instead of hand-rolling `URLSearchParams` —
  the same function the page's Load-more link uses, specifically to prevent the "`q` silently
  drops on page 2" bug class the task called out.
- Clear button and `anyFilter` both include `q`.

## Verification

- `npx vitest run`: **1450 passed** (91 files) — baseline was 1431, so **+19** from this work
  (10 new in `filters.test.ts`: `activitySearchCondition` × 5, `activityConditions` × 2 more,
  `activityParams` × 3; and `search.test.ts` × ~10 across `rankActivityMatches`,
  `fuzzyActivityFallback`, `activityRowSearchText`). Zero failures, zero skips.
- `npx tsc --noEmit`: **1 pre-existing error**, unrelated to this work —
  `src/app/(app)/people/history/page.tsx(200,20): error TS2304: Cannot find name 'asOf'` — in a
  file owned by the other Claude session working in this tree concurrently; nothing under
  `src/features/activity/**` or the activity page reported.
- `npm run lint`: **12 pre-existing problems** (3 errors, 9 warnings), all in files outside this
  task's scope (`meeting-form.tsx`, `meeting-panels.tsx`, `command-center.tsx`,
  `record-timeline.tsx`, `ai-actions.ts`, `apple-icon.tsx`, `meeting-intel.tsx`) — none belong to
  the activity feature; scoped lint of `src/features/activity` and `src/app/(app)/activity`
  alone produced zero output (zero problems).

## Browser verification

The dev server (already running on :3000) redirects unauthenticated requests to `/sign-in`. The
repo's own dev-login path (`DEV_LOGIN_EMAIL` in `.env.local`, wired through NextAuth's plain
`credentials` provider in `src/lib/auth.ts`) let me authenticate directly against
`/api/auth/callback/credentials` with a curl cookie jar — no browser needed, and the shared
Chrome DevTools MCP profile was already locked by the other concurrent session, so I didn't touch
it (would have required force-stealing a browser instance the other session may have been
mid-use on).

With that session cookie, against the real running dev server and its real (Neon) database:

- **Direct SQL-layer sanity check** (small one-off script calling `activitySearchCondition`
  against the live `db`, then deleted): 220 total activity rows; `q=meeting` → 82 matches;
  `q=assigned` → 19 matches; `q=meetign` (typo) → **0** matches (confirms Layer 1 is, as
  designed, typo-intolerant — this is exactly what should force the fallback path);
  `q=xyzzybanana123` → 0 matches.
- **(a) Normal query filters**: `GET /activity?q=meeting` → 200, renders results, and its
  "Load older" link is `href="/activity?q=meeting&before=…"` — i.e. real matches, real
  pagination. `GET /activity?q=assigned` (19 matches, under the 30-row page size) renders with
  **no** Load-older link, while `q=meeting` (82 matches) and the unfiltered trail both do —
  different result-set sizes per query, which a static/no-op filter could not produce.
- **(b) Misspelling shows the close-matches heading**: `GET /activity?q=meetign` → 200, and the
  rendered page contains the literal text `No exact matches — showing close matches for
  "meetign".` — the SQL layer found 0 rows (confirmed above), triggering the bounded
  re-query + `fuzzyActivityFallback`, which found real rows.
- **(c) Load more preserves the query**: confirmed directly in (a) — the `q=meeting` page's
  Load-older `href` carries `q=meeting&before=…` together, not `before=…` alone.
- Genuinely unrelated query (`q=xyzzybanana123`, 0 SQL matches, 0 fuzzy matches too) renders the
  normal "Nothing matches these filters." empty state — never a fuzzy result, never mislabeled.

I did not exercise the debounce/keystroke behavior of the new `SearchFilter` input itself
end-to-end in a real browser (no interactive DevTools session available, per above) — its logic
(draft state, 400ms `setTimeout` debounce, Enter-commits, Escape-reverts, remount-on-external-
change) is the same pattern as the file's existing, working `DateFilter`, and the URL contract it
produces (`activityParams`) is covered by the round-trip tests and the curl-driven checks above.
