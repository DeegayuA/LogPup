# /activity redesign — implementation report

Date: 2026-08-13 · Branch: main · Spec: `docs/superpowers/specs/2026-08-13-activity-redesign-design.md`

---

## 1. Design rationale

### The job, and what was wrong

`/activity` answers *what changed, who changed it, and does it need me*. It answered the first two
adequately and the third not at all, because a flat reverse-chronological list of 30 equal-weight rows has
no shape — every row costs the same to read, so finding the exception means reading all of them.

Five concrete defects in the pre-redesign page:

1. **No shape.** Day headers existed, but rows inside a day were visually identical.
2. **Bursts dominated.** One person editing a meeting's title, agenda and time produced three near-identical
   rows. Density was driven by how *chatty* a write path is, not by how *important* a change is.
3. **Time was not scannable** — buried on a second line under the sentence.
4. **Filtering was a round trip.** Seeing a name in a row and wanting only that person meant going back to
   a select of 30 names. The affordance was on screen; it just wasn't clickable.
5. **Only one of three states existed.** No loading, no error. The whole page — header, filter bar and list —
   blocked on one `Promise.all`, and a failed query hit the framework crash screen.

### What was built

**Burst collapsing** (`groupActivityBursts`, pure + 8 tests). Consecutive rows sharing actor **and**
entity type **and** entity id collapse to one line with a time range, expanding via native `<details>`.
Deliberately narrow: consecutive-only (the stream's order is its meaning), same-*entity* not just
same-actor ("Prabuddha did 6 things" is not information; "Prabuddha changed *this meeting* 6 times" is one
edit session), and **no time window** — a window renders the same data differently depending on where a
page boundary falls, and invents a threshold nobody can justify.

On live data this is doing real work: the first page showed **7 bursts**, one collapsing 5 changes into a
single line.

**The coloured trail rail** (signature). One continuous hairline; every event hangs off it by a node whose
hue is the *product*, from the one identity system (`event-color.ts`, `eventDotClasses`, 8 slots, literal
Tailwind classes). Scanning the rail shows colour bands — the cheapest possible answer to "does any of this
touch my app". App-less changes get a neutral node, per `event-color.ts`'s own rule that a colour meaning
"no product" would read as just another product. Colour is never the sole carrier: the app name is always
rendered beside it.

**One-click filters from the rows themselves.** Actor, entity-type word, app chip and day marker are all
links built through the single `activityParams()` builder the filter bar and Load-more link already share,
so a fourth family of links cannot drift from the other three. Each keeps every other active filter (so
clicking through *narrows*) and drops the `before` cursor (page two of the old question is not a page of the
new one). The entity-type **word inside the phrase** is the link rather than an added chip — the word
already carries the meaning and already sits where the eye is.

**Day markers with weight.** Sticky at `top-14` (under the 56px app header), carrying `Today · 2026-08-13 ·
30 changes · 2 people`. The weight is what lets a reader skip a quiet day without reading it.

**Time as a right-hand mono column**, so a day's chronology reads straight down.

**Three states.** Loading (`loading.tsx` + `activity-skeleton.tsx`, shaped like the rail, never spinners),
error (`error.tsx`, matching `people/error.tsx`), and an empty state that now **offers** the next action —
a "Clear all filters" button — instead of the old copy that said "clear them all" and gave nothing to click.

**Zero client JS added.** The page stays a server component; the only client component on the route is
still `ActivityFilterBar`. Burst expansion is native `<details>`, every filter affordance is an `<a>`.

### Honest constraints respected

- **No invented links.** A survey of the 73 `logActivity` call sites found meetings record
  `pagePath: '/meetings'` because **no `/meetings/[id]` route exists**. I did not synthesise one — a link
  that silently does nothing is worse than the honest list page.
- **No "since you last looked" divider**, which would be the single most useful addition. It needs a stored
  per-user watermark → a migration, and migrations here are hand-written under a documented trap list.
  Recorded in the spec as the strongest future addition rather than smuggled in.
- **No new tokens.** Nothing introduces a hue, radius, shadow or type size the "watchdog calm" system
  (`2026-08-11-ui-redesign-design.md`) did not already define.

### Spec grounding note

The brief pointed at `2026-08-10-logpup-design.md` for "watchdog calm". That file is the **product** design
spec; the *visual system* named "watchdog calm" (tokens, type, motion, the ⌘K signature) actually lives in
`docs/superpowers/specs/2026-08-11-ui-redesign-design.md`. The new spec grounds itself in the latter and
cites both.

---

## 2. The six frontend API concerns

| Concern | Verdict | Reasoning |
|---|---|---|
| Request dedup | **Applied** | `listActivityActors` / `listActivityApps` are React `cache()`d and are now called from **two** Suspense boundaries (`ActivityDescription` and `ActivityControls`). The per-request cache collapses those to one query each. The Suspense split I introduced is only affordable *because* dedup exists — without it, splitting would have doubled the filter-list queries. |
| Optimistic updates + rollback | **Deliberately skipped** | There is no mutation on this page. `/activity` is append-only and read-only; the trail is written by `logActivity()` from *other* features' server actions. There is no user write to predict and no rollback state to hold. Adding it would mean inventing a write path the product deliberately does not have — the log is bookkeeping, never user-editable. |
| Streaming UI | **Applied — the biggest structural change** | Three independent Suspense boundaries replace one blocking `Promise.all`. The h1 paints from the URL alone; the description and filter bar stream behind two cheap `selectDistinct`s; the trail streams behind the paged scan (plus a second fallback query on a search miss). Before, changing a filter blanked the control you had just used. This is the repo's "controls render before data" rule, which the page previously violated. |
| SWR-style revalidation | **Deliberately skipped** | SWR's value is instant-stale-then-refresh, and it needs a client cache plus a client fetch. Here the data is already server-rendered, fully determined by the URL, and **append-only** — a row never changes after it is written, so "stale" can only ever mean "missing the newest rows", never "wrong". Next's router cache already gives instant back/forward. Adding SWR would convert a zero-JS page into a client-fetching one to solve a problem this data shape does not have. |
| Smart polling | **Deliberately skipped — stated cost** | Polling buys "the trail updates while I watch it". It costs: a client component wrapping the feed; one query per interval **per open tab**, on a firehose page across a 30-person team that is exactly the kind of page people leave open; and a genuine correctness problem — new rows arrive at the **top** while the keyset cursor anchors the **bottom**, so a naive refetch duplicates or skips rows around the boundary. Against that, nobody blocks on this page: it is a forensic/scanning surface, not an ops alarm, and the event-driven notifications/mentions surface is the correct trigger for "something needs me". If live-ness is ever wanted, the honest design is a *"N new changes — show them"* affordance on a cheap count query, not a refetch loop. |
| Preloading | **Applied** | Every new affordance (actor, entity type, app, day marker) is a real `next/link` into this same route, so Next prefetches on hover/viewport — this is what makes the redesign's central interaction feel instant. It only works because I added `loading.tsx`: a dynamic route with **no** loading boundary is not partially prefetchable at all. The loading state and the preloading are therefore the same decision, and that is documented in `loading.tsx`. |

---

## 3. Review lens findings and fixes

### Lens 1 — React / Next correctness

| # | Finding | Severity | Action |
|---|---|---|---|
| 1.1 | `ActivityFeed`'s `now` prop was documented as making the render deterministic ("so server render and tests agree") but the code called `formatDistanceToNow(row.createdAt)`, which reads the wall clock and ignores `now` entirely. Latent since the component was written. | Medium | **Fixed** — switched to `formatDistance(row.createdAt, now, …)`. |
| 1.2 | The single blocking `Promise.all` made the filter bar wait on the paged trail scan. | High | **Fixed** — three Suspense boundaries; controls no longer wait on data. |
| 1.3 | Route had no `loading.tsx`, so it was not partially prefetchable — which would have silently disabled prefetch for every new filter link. | Medium | **Fixed** — added `loading.tsx`. |
| 1.4 | Route had no `error.tsx`. | Medium | **Fixed** — added, `'use client'`, matching `people/error.tsx`. |
| 1.5 | Overloading `ActivityFeed` with a `grouped` boolean would have forced `current` to be optional-but-required, an unsound signature. | Low | **Fixed by design** — split into `ActivityFeed` (flat, dashboard) and `ActivityTrail` (grouped, /activity), each with exactly the props it needs. |

Verified clean: no `setState`-in-effect anywhere in the new code (there are no effects — nothing added is a
client component except `error.tsx`, which uses `useEffect` only to log); keys are row ids (unique by
construction, each row appears in exactly one entry — asserted by a test); `searchParams` is correctly
awaited as a Promise for Next 16.

**Independently re-reviewed** by a dedicated React/Next reviewer against this repo's pinned Next 16.3.0
docs: **no defects at critical/high/medium**, `eslint` and `tsc` clean on all seven files. It specifically
confirmed the two claims this redesign rests on:

- the three `<Suspense>` boundaries are **siblings, not nested**, and each async component is passed as a
  bare JSX element rather than awaited by the parent — so they genuinely stream independently;
- `cache()` stores the promise *synchronously* on first call, so the second boundary joins the in-flight
  query rather than issuing a new one. The dedup that makes the Suspense split affordable is real.

It also flagged one convention worth recording so nobody "corrects" it from memory: `error.tsx` takes
**`retry`**, not `reset`. `retry` is the stable prop as of this repo's Next 16.3.0
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`), superseding the
`reset` that older training data would suggest. `people/error.tsx` uses the same signature.

### Lens 2 — Accessibility (WCAG 2.1 AA)

Measured in a real browser, not asserted.

| # | Finding | Severity | Action |
|---|---|---|---|
| 2.1 | **Heading order.** The old page went `h1` → `h3` (day headers), a skipped level. | Medium | **Fixed** — day markers are now `h2`. Audited live: the document is `h1 Activity` → `h2 <day>` → `h2 Command center`. No skips. |
| 2.2 | Filter links would have had accessible names that replaced the visible text, risking WCAG 2.5.3 (Label in Name). | Medium | **Avoided by design** — every `aria-label` *contains the visible text verbatim* (`Filter activity by Prabuddha Silva`), so speech input still matches. |
| 2.3 | Contrast of the new muted tones. | — | **Verified pass.** Measured via canvas colour conversion against computed backgrounds: day label 16.15, day date 5.11, day weight 5.11, row time 5.11, muted verb 5.11, actor link 16.15, burst summary 5.11, app chip **4.80** (tightest). All ≥ 4.5 AA for normal text. |
| 2.4 | Status conveyed by colour alone (the rail node hue). | — | **Not an issue** — the app name is always rendered as a chip beside the node, and the node is `aria-hidden`. Same contract the calendar already runs under. |
| 2.5 | Focus visibility on the new trail links. | — | **Verified** — a trail filter link focuses with a visible ring and matches `:focus-visible`. Shared `FOCUS` constant matches the repo's primitives. |
| 2.6 | Icons carrying meaning without text. | — | **Verified** — the chevron and the rail node are `aria-hidden`; the disclosure's own text ("6 changes") is the label, and no icon is the sole carrier of anything. Skeletons carry `role="status"` + `sr-only` text. |
| 2.7 | Nested interactive content inside `<summary>` (one click both navigating and toggling). | Medium | **Avoided by design** — the actor/type/app links live in the sentence *above* the `<details>`; the `<summary>` contains only the chevron and its own text. |
| 2.8 | **Pre-existing, not fixed:** Base UI logs "a component that acts as a button expected a native `<button>`" for `<Button render={<Link/>}>`. | Low | **Investigated, left alone deliberately.** Used at **24 call sites repo-wide** including the pre-redesign `/activity` page. Verified in the DOM that the rendered element is `<a role=null href=…>` — i.e. a correct link, *not* announced as a button. So it is a dev-console advisory, not an a11y defect. The right fix is once, in the shared `Button` primitive (`nativeButton={false}`), not 24 times — and the design system spec freezes `src/components/ui/*` during page redesigns. Flagged for a follow-up. |

### Lens 3 — Visual craft

| # | Finding | Severity | Action |
|---|---|---|---|
| 3.1 | **App chip duplicated its own subject** on `app`-type rows: "changed app **PM Test App 1786624225377** `PM Test App 1786624225377`". Found on real data. | Medium | **Fixed** — chip suppressed when `appName === entityLabel`. Compared by string rather than special-casing `entityType`, so it also catches a task or meeting named after its app. Re-verified live: zero remaining duplicates. |
| 3.2 | **Burst time ranges wrapped mid-range** in the fixed `sm:w-24` clock column ("6:57 PM – 7:02\nPM"). | Medium | **Fixed** — `sm:min-w-24` + `whitespace-nowrap`. Column alignment is unaffected because the row is `justify-between`, so every time still sits flush to the same right edge. Re-verified: zero wrapped times. |
| 3.3 | **Filter links and the subject link shared one hover affordance**, so "narrows this page" and "leaves this page" were indistinguishable until after the click. | Medium | **Fixed** — filter links hover **dotted**, the subject hovers **solid**, app chips **tint**. Never colour alone. |
| 3.4 | `Badge` (`h-5 overflow-hidden`) would clip Sinhala app names — the UI is bilingual and app names are user text. The old feed used `Badge` for exactly this. | Medium | **Fixed** — the trail's app chip is padding-based with no fixed height. No fixed-height container anywhere in the new feed. |
| 3.5 | `new Date(\`${dayIso}T00:00:00\`)` for the weekday name parses as *local* midnight, which is not a real instant on a spring-forward day. | Low | **Fixed** — midday anchor, matching `people/history`'s documented rationale. |
| 3.6 | Motion discipline. | — | **Verified** — no `transition: all`; named properties only (`transition-colors`, `transition-transform`), 150ms ease-out, `motion-reduce:` on every one, `motion-reduce:animate-none` on skeletons. Confirmed the chevron actually rotates (`rotate: none → 90deg`) — note Tailwind v4 animates the **`rotate`** property, not `transform`, and `transition-transform` correctly covers `transform, translate, scale, rotate`. |
| 3.7 | Tokens / mono discipline. | — | **Verified** — no raw hex or oklch in any new component; every colour is a token or an `event-color.ts` class. Every data value (times, day date, day counts, burst counts) is `font-mono tabular-nums`. |
| 3.8 | Sticky day marker behaviour. | — | **Verified live** — `position: sticky; top: 56px`, sits under the 56px app header, y went 248 → 73 on scroll. |
| 3.9 | Narrow viewport. | — | **Verified at 390px** — rows stack, the time drops below the sentence, the rail persists, `scrollWidth === clientWidth` (no horizontal overflow). |

### Lens 3b — independent regression review (the one that found real bugs)

A second reviewer diffed every changed file against `git show HEAD:` looking only for regressions. It found
one genuine regression and two risks. All three are fixed and re-verified in the browser.

| # | Finding | Severity | Action |
|---|---|---|---|
| R1 | **Search results lost their date.** With `q` set, `grouped` is false, so no day marker renders — and `TrailEvent` printed only a clock time ("6:57 PM"). HEAD's flat branch printed `formatDistanceToNow` ("3 weeks ago"), so results carried their age. In the one view where rows are ordered by **relevance**, position gives no date cue either, so a hit from last month looked identical to one an hour old. | **High — real regression** | **Fixed** — `TrailEvent` takes `withDate`, set only in the ungrouped branch, printing `Aug 13 · 6:57 PM` via `formatBusinessDayMonth` (Colombo-safe). Grouped rows stay time-only, because the day marker above them already carries the date. Verified: search shows `Aug 13 · 7:02 PM`, grouped shows `7:02 PM`. |
| R2 | **Rail hue was colour-only information on a large share of rows.** `RailNode` coloured by `appId`, and its comment claimed "the app name is always rendered as a chip beside it" — but `AppChip` returns null when `appName` is null, and **~31 `logActivity` call sites record an `appId` with no `appName`**. Those rows carried product identity by hue alone (WCAG 1.4.1). New code, not a HEAD regression, but the invariant the file asserted did not hold. | **Medium** | **Fixed twice over.** (a) `listActivity` now `COALESCE`s the live `apps.name` over the denormalised `activity_log.app_name` — the same join `listActivityApps` already used, for the same documented reasons — so those rows get a real label (and a renamed app now reads under its current name). (b) `RailNode` keys its hue off `appName`, not `appId`, so a row can only ever be coloured when its product is **also named in text**. Measured live: **16 coloured nodes, 0 coloured without a name.** |
| R3 | **Unverified risk: does the filter bar now flash a skeleton on every filter change?** Both new boundaries render a skeleton; if React does not reuse the boundary across a searchParams-only navigation, the control the reader just touched is replaced by a shimmer — the exact behaviour the redesign claims to remove. The reviewer could not settle it by reading. | **Needed proof** | **Settled empirically — it does not.** Installed a `MutationObserver` before clicking a filter link and counted skeleton appearances: **0 controls, 0 trail**, filter bar present throughout. Next wraps navigations in a transition, so already-mounted Suspense boundaries keep their content. The claim in `page.tsx` holds. |

R2's query change is a real product improvement beyond the a11y fix: sprint and task rows previously
showed **no app chip and no hue at all** (their call sites record an id without a name). They now carry
both — visible in the before/after screenshots.

### Regression check against `git show HEAD:`

Everything the brief listed as must-not-regress was re-verified in the running app, not just by reading:

- actor / type / app / date-range filters — intact;
- keyset pagination and the `lte`-not-`lt` subtlety — **filters.ts untouched**;
- the Load-more cursor still taken from the **primary** SQL-ordered `rows`, never the re-ranked/fallback view;
- `q` surviving into Load-more — intact (one `activityParams` builder, now four call sites);
- two-layer search — Layer 1 `ilike`, then rank-or-fuzzy-fallback; **search.ts and queries.ts untouched**;
- the fuzzy fallback still quarantined behind an explicit heading, now strengthened from a muted sentence
  into a labelled `role="status"` banner that also names its scope ("from the most recent page");
- day grouping (and now burst collapsing) still suppressed when `q` is set, so relevance order is visible;
- Asia/Colombo bucketing via `isoDayOf` and clock times via `formatBusinessTime` — intact;
- the dashboard's Recent-activity card still renders through `ActivityFeed` — call site unchanged, and the
  flat variant now honours its `now` prop for the first time.

The only element removed from a /activity row is the **actor avatar**, deliberately: the rail node is the
new scan aid, the actor name became a filter link, and 30 repetitions of the same six faces was the noise
this redesign set out to remove. The dashboard's flat variant keeps its avatars.

---

## 4. Verification output

```
$ npx vitest run          (baseline before changes: 120 files / 2007 tests)
 Test Files  121 passed (121)
      Tests  2032 passed (2032)          ← +1 file, +25 tests, all new and mine

$ npx vitest run src/db/live.test.ts
 Test Files  1 passed (1)
      Tests  18 passed (18)              ← soft deletes live and green

$ npx tsc --noEmit
 clean (exit 0)

$ npm run lint
 ✖ 23 problems (3 errors, 20 warnings)   ← ALL pre-existing / other sessions';
                                            zero in any file I touched
```

New tests (25): `groupActivityBursts` ×8, `activityDaySummary` ×2, `activityPhraseParts` ×3,
`isoDayLabel` ×2, `describeActivityFilters` ×6, `activityFilterHref` ×4.

### What I actually saw at `localhost:3000/activity`

Driven with a real Chromium against the running dev server, authenticated with the repo's stored Playwright
state. Read-only — GET navigations only, no mutations.

| Exercise | Result |
|---|---|
| Load `/activity` | 200. `h1 Activity`, description "Every change across the team, newest first.", day marker `TODAY 2026-08-13 30 changes · 2 people`, **7 bursts** on the first page, coloured rail nodes (amber / teal / green by app). |
| Filter (`?type=meeting`) | 200, description became "meeting changes, newest first.", trail narrowed. |
| Search (`?q=meeting`) | 200, description "Changes matching "meeting"", day grouping and bursts correctly suppressed (relevance order preserved). |
| **Misspelled** search (`?q=meetign`) | 200. Fallback banner rendered: *"No exact matches for "meetign". Showing close matches from the most recent page instead, best first."* — matched `moved meeting Quick notes`. Never presented as exact. |
| Empty + filtered | Empty state with paw icon, "Nothing matches these filters." and a working **Clear all filters** button. |
| **Load more** | Link href carried the cursor (`?before=2026-08-13T09%3A10%3A06.444Z%7C2dfc…`), click navigated, page two rendered. |
| One-click row filter | Clicking an actor (`aria-label="Filter activity by Deeghayu Adhikari"`) landed on `/activity?person=0be8f2df-…`. |
| Burst expansion | `<details>` opened, sub-rows rendered as `time · verb · detail`, chevron rotated. |
| Dark theme | Tokens hold; rail hues remain legible. |
| Mobile (390px) | No horizontal overflow; rows stack gracefully. |
| Console | No page errors. Only the pre-existing Base UI `nativeButton` advisory (finding 2.8). |

---

## 5. Files

**Changed**
- `src/app/(app)/activity/page.tsx` — Suspense split, description line, states, `ActivityTrail`
- `src/features/activity/components/activity-feed.tsx` — the redesign; `ActivityFeed` (flat) + `ActivityTrail` (trail)
- `src/features/activity/format.ts` — `activityPhraseParts`, `activityDaySummary`, `groupActivityBursts`
- `src/features/activity/format.test.ts` — +13 tests
- `src/features/activity/queries.ts` — **the one query change**: `listActivity` left-joins `apps` and
  `COALESCE`s the live name over the denormalised one (finding R2). Filter/cursor/search composition is
  untouched; `activityConditions` is still the sole `WHERE` builder and all its tests are unchanged.

**Added**
- `src/app/(app)/activity/loading.tsx`, `src/app/(app)/activity/error.tsx`
- `src/features/activity/describe.ts` (+ `describe.test.ts`, 12 tests)
- `src/features/activity/components/activity-skeleton.tsx`
- `docs/superpowers/specs/2026-08-13-activity-redesign-design.md`

**Untouched, deliberately** — `filters.ts`, `search.ts`, `types.ts`, `log.ts`, `activity-filter-bar.tsx`,
and `src/db/schema.ts`. **No migration was written or generated; `drizzle-kit generate` was never run.**

---

## 6. Open items / follow-ups

1. **Base UI `nativeButton` advisory** — fix once in the shared `Button` primitive, not at 24 call sites.
   Verified harmless today (renders as a proper link), but it is console noise across the whole app.
2. **"Since you last looked"** — the strongest remaining improvement, blocked on a stored per-user
   watermark (a migration). Deliberately not attempted.
3. **Meeting deep links** — 35 `logActivity` call sites record `pagePath: '/meetings'` because no
   `/meetings/[id]` route exists. If that route is ever added, those subjects become genuinely useful
   links with no change needed here.
