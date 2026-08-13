# Activity Trail Redesign — Design Spec

Date: 2026-08-13 · Branch: main · Status: approved-by-directive (autonomous session; redesign requested with "spec first, then build")

Extends — does not replace — `2026-08-11-ui-redesign-design.md` ("watchdog calm"). No new palette, no new
type scale, no new radius. Every colour named here is an existing token. The page shipped in
`2026-08-12-dashboard-activity-design.md` §2; this is a **presentation** redesign of that page. The query,
filter, cursor and two-layer search layers are load-bearing and stay exactly as they are.

## 1. The page's job

**One sentence:** `/activity` is the team's shared memory — it answers *what changed, who changed it, and
whether it needs me*, for any slice of people, products, kinds of thing and days you care to ask for.

The emphasis matters. The trail already answered *what changed* well. It answered *does it need me* not at
all, because a flat reverse-chronological list of 30 equal-weight rows has no shape: every row costs the
same to read, so the only way to find the one that matters is to read all of them.

## 2. Who reads it, and what decision it serves

Two readers, both real, with different questions:

| Reader | Question | Decision it serves |
|---|---|---|
| The tech lead (admin) | "What moved while I was in meetings, and did anyone touch something I own?" | Whether to intervene today — chase a status change, re-open a task someone closed, ask why a sprint moved. |
| A teammate (member) | "Did anything happen to *my* thing?" | Whether their own work is still where they left it. |

Both are **scanning for an exception**, not reading a log. That is the whole design brief: the page must
make the exception cheap to find and the routine cheap to skip.

A third reader exists and is served by the same surface: whoever is doing forensics — "when exactly did
this task get reassigned, and by whom". That reader arrives with a filter already in mind and needs the
filters to be reachable *from the rows*, not only from a bar at the top.

## 3. What is wrong with the current page

Read the pre-redesign `src/app/(app)/activity/page.tsx` and `components/activity-feed.tsx` and five
concrete defects fall out:

1. **No shape.** Day headers exist, but every row inside a day is visually identical, so the eye has no
   entry point. 30 rows of `avatar · sentence · time · badge` is a wall.
2. **Bursts dominate.** One person renaming a meeting, then its agenda, then its time, produces three
   near-identical rows. A meeting edited eight times in four minutes eats a third of the page and pushes
   the one interesting change below the fold. The trail's density is driven by how *chatty* a write path
   is, not by how *important* the change is.
3. **The time is not scannable.** `9:05 AM` sits on a second line under the sentence, in a row that also
   carries a badge. Within a day you cannot read the chronology down a column; you read it by hunting.
4. **Filtering is a round trip.** Seeing "Prabuddha" in a row and wanting only Prabuddha's changes means
   going back up to the filter bar and finding them in a select of 30 names. The affordance is on screen
   already — it just isn't clickable.
5. **Only two of three states exist.** There is an empty state and no loading or error state at all: the
   whole page (header, filter bar, list) blocks on one `Promise.all`, and a failed query lands on the
   framework's crash screen. Both break rules the repo enforces everywhere else (`people/history` is the
   reference).

## 4. Information hierarchy

Top to bottom, strongest to weakest:

1. **What you asked for** — the h1 plus a live one-line answer: `Every change, newest first` or, when
   filtered, `Changes by Prabuddha in LogPup · Aug 1 – Aug 13`. The page must always say out loud which
   slice you are looking at, because every row below is conditional on it.
2. **The controls** — filter bar. Rendered before the data, always (§8).
3. **The day** — a sticky day marker carrying the date *and the day's weight* ("Today · 18 changes ·
   5 people"). Weight is what lets a reader skip a quiet day without reading it.
4. **The change** — one line per event (or per burst), read as a sentence.
5. **The provenance** — entity-type and app chips, and the clock time. Present on every row, but tuned
   down: these are what you filter *by*, not what you read.

Within a single row, left to right:

```
│●  Prabuddha Silva  moved task  Fix login  to In progress      [task] [LogPup]   9:05 AM
```

- **`●`** — the rail node, coloured by the product (§6).
- **Actor** — `font-medium`, foreground. A link that filters to that person.
- **Verb phrase** — `text-muted-foreground`. Grammar, not information; it must not compete.
- **Subject** — `font-medium`, and a real link to the thing that changed whenever the write recorded a
  destination. This is the row's strongest element after the actor, because it is the only part that
  gets you out of the trail and into the work.
- **Detail** — muted. "to In progress", "from Sprint 4".
- **Chips** — entity type and app, both filter links, `text-2xs`, muted.
- **Time** — right-aligned, `font-mono tabular-nums`, in its own fixed column so a day's chronology reads
  straight down.

Rejected orderings, and why: leading with the **verb** ("Moved · Prabuddha · Fix login") turns every row
into a form and destroys sentence-reading — the trail's one genuine pleasure. Leading with the **subject**
groups by thing, which is what a per-entity timeline is for, not a firehose.

## 5. Grouping — how a day, and a burst, is read

Three levels, all computed by pure functions with tests, all in Asia/Colombo via `iso-day.ts`
(`isoDayOf` / `isoDayDiff`) — never a UTC slice.

**Day** (`groupActivityByDay`, already exists and is already correct). Kept. The header gains:
- the day's weight — `N changes · M people`, mono tabular-nums;
- a click target: the whole marker is a link that sets `from=to=<that day>`, so "just show me the 11th"
  is one click from where you noticed it.

**Burst** (`groupActivityBursts`, new, pure, tested). Consecutive rows in the stream that share
`actorId` **and** `entityType` **and** `entityId` collapse into one entry. The rule is deliberately
narrow:

- *Consecutive only.* The stream is already `created_at desc`; collapsing non-adjacent rows would reorder
  the trail, and the trail's order is its meaning.
- *Same entity, not just same actor.* "Prabuddha did 6 things" is not information. "Prabuddha changed
  *this meeting* 6 times" is — it is exactly one edit session.
- *No time window.* A window (say 10 minutes) sounds right and is wrong: it makes the same data render
  differently depending on where a page boundary falls, and it invents a threshold nobody can justify.
  Adjacency in the stream is already a strong proxy — a same-actor/same-entity run is only broken by
  someone else's change or by a different subject, which is precisely when the burst should end.
- *Minimum 2.* A run of one renders as an ordinary row, with no wrapper, no disclosure triangle.

A burst renders as its own row — `Prabuddha Silva made 6 changes to Standup` with a time **range**
(`9:05 – 9:22 AM`) — and expands, via native `<details>` / `<summary>`, into the individual changes
underneath. Native disclosure, not a client component: it is keyboard-operable and screen-reader-labelled
for free, and this page ships zero client JS below the filter bar (§9).

A burst may straddle a page boundary; it then renders as two shorter bursts. Accepted — the alternative
is looking ahead past the keyset cursor, which would break pagination to tidy a display detail.

**When grouping is OFF.** With `q` set, rows are ordered by *relevance* (`rankActivityMatches` /
`fuzzyActivityFallback`), not by time. Day grouping is already suppressed there, and burst collapsing is
suppressed for the same reason: both are statements about chronological adjacency, and neither is true of
a relevance-ordered list. A searched trail stays flat, in rank order, so the ranking is visible.

**The fuzzy fallback stays quarantined.** The "No exact matches — showing close matches" heading is not
decoration; it is the promise that a fuzzy result is never presented as an exact one. It is kept, and
strengthened from a muted sentence into a labelled banner that also names the fallback's scope ("searched
the most recent page").

## 6. Signature element — the coloured trail rail

One continuous hairline runs down the left of the feed. Every event hangs off it by a node; every day
punches a marker into it. It is what makes the page read as *one trail* rather than a stack of cards —
and "complete backtrack" was the user's own word for what this page is.

The node is not decoration. **Its hue is the product**, taken from the one identity-colour system
(`src/features/meetings/event-color.ts`, `eventDotClasses(appId)`, 8 slots, literal Tailwind classes).
So scanning the rail, a reader sees colour bands: *those six changes were all LogPup*. That is the
cheapest possible answer to "does any of this touch my app", and it costs no new system, no second hash,
and no stored column. A change with no app gets a neutral node, exactly as `event-color.ts` requires —
a colour meaning "no product" would read as just another product.

Colour is never the only carrier: the app name is always rendered as a chip on the row, which is the same
contract the calendar already runs under (WCAG 1.4.1 — see §8).

Why a rail and not cards: cards give every event equal, generous weight, which is the opposite of what a
firehose needs, and 30 cards is 30 borders. Why not a two-column timeline with alternating sides: it is a
marketing-page pattern, unreadable at 30 rows, and it doubles the horizontal scan distance.

## 7. Making the affordances do their job

Three things a reader points at are already on every row. All three become one-click filters, built with
the existing `activityParams()` — the same function the filter bar and the Load-more link use, so a fourth
call site cannot drift from the other three:

| Element | Sets | Keeps |
|---|---|---|
| Actor name | `person=<id>` | every other active filter |
| Entity-type chip | `type=<type>` | every other active filter |
| App chip | `app=<id>` | every other active filter |
| Day marker | `from=<day>&to=<day>` | every other active filter |

All four **drop the `before` cursor** — page two of the old question is not a page of the new one, which
is the rule the filter bar already follows.

Each is a plain server-rendered `<a>`. Their accessible names say what they do and contain the visible
text verbatim (`Filter activity by Prabuddha Silva`), so speech input still works (WCAG 2.5.3).

Separately, the **subject** stays a link to the thing itself (`pagePath`), never a filter. The two link
kinds are distinguished by weight and by hover: the subject underlines, the filter chips tint. No invented
destinations — a survey of the 73 `logActivity` call sites shows meetings record `pagePath: '/meetings'`
because **no `/meetings/[id]` route exists**. Synthesising one would produce a link that silently does
nothing, which is worse than the honest list page. Rows whose write recorded no path stay plain text; the
trail's job is to remember, not to guarantee the page still exists.

## 8. The three states

**Empty** — two cases, both with a real next action, not prose describing one:

- *Filtered to nothing:* "Nothing matches these filters." + the filters restated + a **Clear filters**
  button (a link to `/activity`). Today the copy says "clear them all" and gives you nothing to click.
- *Never tracked:* watchdog voice — "Nothing tracked yet." + what will land here + a link into the
  product so the page is not a dead end.

**Loading** — new, and the bigger structural fix. Today one `Promise.all` gates the entire page, so
changing a filter blanks the control you just used. Two Suspense boundaries instead:

- The **header** renders instantly, from the URL alone — including the "what you asked for" line.
- The **filter bar** streams behind its own boundary (two cheap `selectDistinct` queries, both already
  `cache()`d).
- The **feed** streams behind its own boundary (the page query, plus the fallback re-query when it fires).

Skeletons, never spinners, shaped like what is coming: a rail with day markers and rows of the right
heights. Plus `loading.tsx` for cold entry into the route — without it the route is not partially
prefetchable at all, which would silently kill the hover prefetch every filter link now depends on.

**Error** — new. `error.tsx` in the segment, matching `people/error.tsx`: what failed in plain words, the
`digest` as a mono reference, **Try again**, and a route back into the product. A failed trail query
currently drops the user on the framework crash screen.

## 9. Client/server boundary

The page stays a **server component**, and everything added here is server-rendered. The only client
component on the route remains `ActivityFilterBar`, which needs `useRouter` and local input drafts. In
particular:

- Burst expansion is native `<details>`, not `useState`.
- Every filter affordance is an `<a>`, not an `onClick`.
- Day markers, the rail, chips, times: all server output.

A log line never changes after the fact. There is nothing on this page worth shipping JavaScript for.

## 10. Tokens and craft

- Rail hairline: `border-border`. Nodes: `bg-event-1..8` via `eventDotClasses`, neutral node
  `bg-muted-foreground/40`.
- Day marker: `bg-background/95 backdrop-blur` sticky, `text-2xs uppercase tracking-wide` label,
  `font-mono tabular-nums` date and counts.
- Times, counts, dates: `font-mono tabular-nums` without exception.
- Spacing on the 4px scale (`gap-1`/`2`/`3`, `py-2`, `pl-6`).
- Motion: only `transition-colors`/`transition-[background-color,border-color]` at 150ms ease-out on
  hover targets, and the `<details>` marker rotation as a `transform`. No `transition: all`.
  `motion-reduce:transition-none` everywhere, matching the primitives.
- Sinhala renders taller than Latin: no fixed-height row containers anywhere in the feed. Rows grow.
  Entity labels are user text and are frequently code-switched — never truncated to a fixed height, only
  wrapped.

## 11. Explicitly avoided defaults

- **GitHub's activity feed** — avatar-per-row, icon-per-verb, grey card stack. It is the first thing
  anyone reaches for and it produces exactly the wall this redesign is fixing: 30 avatars of the same six
  people is noise, and a bespoke icon per verb invents a second visual language on top of the verb word
  that is already there.
- **A "Timeline" with alternating left/right cards.** Marketing pattern. Unusable at 30 rows.
- **An icon per entity type.** Ten types, ten glyphs to learn, all carrying meaning that the word "task"
  already carries better and searchably.
- **A colour per verb** (green created / red deleted / amber updated). Tempting, and wrong twice: it is a
  second colour system competing with `event-color.ts`, and it puts the loudest colour on `deleted`, which
  is usually the least interesting row on the page. The one colour dimension is the product.
- **Infinite scroll.** The existing "Load older" link is a real URL with a real cursor, which is
  shareable and back-button-correct. Infinite scroll would force a client component and lose both.
- **Live polling.** See the report's API evaluation — an append-only audit log that nobody is waiting on
  in real time does not justify a request every N seconds across 30 open tabs.
- **A "since you last looked" divider.** Genuinely the most useful thing this page could have, and
  deliberately not built: it needs a stored per-user watermark, which needs a migration, and migrations in
  this repo are hand-written under a documented trap list. Noted as the strongest future addition rather
  than smuggled in.
- **New tokens.** Nothing here introduces a hue, a radius, a shadow or a type size that "watchdog calm"
  did not already define.

## 12. What must not regress

Enumerated so the review lens has something to check `git show HEAD:…` against:

- actor / entityType / app / from / to filters, and their degrade-to-unfiltered Zod contract;
- keyset pagination, including the `lte`-not-`lt` subtlety in `activityConditions`;
- `q` surviving into the Load-more link (one `activityParams` builder, now four call sites);
- Layer 1 SQL `ilike` narrowing + Layer 2 fuzzy fallback, the fallback always under its own heading and
  never presented as exact;
- the Load-more cursor coming off the **primary** SQL-ordered page, never the re-ranked view;
- day bucketing in Asia/Colombo, and clock times via `formatBusinessTime` (never date-fns `format`, which
  resolves in the server's zone);
- `ActivityFeed`'s flat variant, which the dashboard's Recent-activity card also renders.

## 13. Testing

Repo pattern — logic-only, no DOM:

- `groupActivityBursts`: collapses a same-actor/same-entity run; does not collapse across a different
  actor; does not collapse across a different entity; leaves a run of one uncollapsed; preserves stream
  order; is a no-op on `[]`.
- `activityDaySummary`: distinct-actor and change counts per day.
- `describeActivityFilters`: the header's "what you asked for" line, for every combination of filters.
- Existing `filters.test.ts` / `search.test.ts` / `format.test.ts` / `log.test.ts` stay green untouched.
