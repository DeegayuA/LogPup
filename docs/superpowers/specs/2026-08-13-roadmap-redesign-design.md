# Roadmap surface — redesign

**Date:** 2026-08-13
**Amends:** [2026-08-12-unified-roadmap-design.md](2026-08-12-unified-roadmap-design.md). The merge of Board
and Roadmap into one tab stands. What shipped underneath it does not.

## 1. What went wrong

The unified surface was specified as four bands, each answering something the
others do not. It shipped as **nine**, and most of them restate their
neighbours.

| Duplicate | Where |
|---|---|
| Two timelines, both open at once | `RoadmapSpine` at the top, `RoadmapTimeline` inside a `LazyDisclosure` with `defaultOpen={isAdmin}` |
| Two zoom controls | Weeks/Months/Quarters in the spine header **and** in the timeline below |
| Two sprint selectors | spine bars **and** `SprintSwitcher` dropdown |
| The selected sprint's name, four times | spine bar, dropdown trigger, header card, timeline bar |
| "This sprint is empty", eight times | spine bar label, read strip sentence, six zeroes in the stat row, board banner, three column empty states, three column count badges |
| The same empty-state headline, twice, byte for byte | `page.tsx` "Nothing to fetch here yet" and `board.tsx` "Nothing to fetch here yet" |

Two of those contradict the previous spec in terms it wrote itself:

- §3 — *"There is no second control, no tab, no dropdown."* `SprintSwitcher` is
  a second control, and it carries a code comment arguing for it.
- §8 — *"Two open timelines on one screen would be exactly the duplication this
  merge exists to remove."* `defaultOpen={isAdmin}` opens the second one for
  every admin, every visit. The comment above that line explains the reasoning
  (a collapsed disclosure read as the feature being gone) and the reasoning is
  sound — the *conclusion* is what this document replaces. The fix for "the
  edit affordance is hidden" is not "render both timelines."

### The craft failure

The largest type on the surface is a row of zeroes.

`BoardToolbar` renders five stats at `text-xl font-bold`. Every number in that
row already exists somewhere the reader is looking anyway:

| Stat | Already rendered at |
|---|---|
| In progress, To do | the column headers, with a share hairline under each |
| Overdue | a badge on the Overdue filter button, in the same toolbar |
| Unassigned | a linkable chip in `PlanReadStrip`, directly above |
| done / total / % | the spine bar's own fill, directly above |

`PlanReadStrip`'s own doc comment says *"a row of green zeroes is how a status
line teaches people to stop reading it"* — and the toolbar renders one three
band-heights below that sentence.

### The consequence

Board columns begin roughly 840px down the page. The object the surface exists
for is below the fold; the chrome for changing it is above and below.

## 2. The rule this redesign is built on

> **One band, one object. No band restates its neighbour.**

Where two surfaces state the same fact, the one nearer the work keeps it.

## 3. The shape

```
┌ PLAN ─────────────────────────────────────────────────────────────────┐
│  spine bars · today line · zoom            [All sprints ⌄] [＋ Sprint] │
│  ── or, in edit mode, the full timeline in this same slot ──          │
└───────────────────────────────────────────────────────────────────────┘
┌ SPRINT  (sticky, top-14) ─────────────────────────────────────────────┐
│  Three  active   Aug 19–30 · 4d left      11/18 ▓▓▓░░ 61%  [⋯ actions]│
│  goal, one line                           2 unassigned · 1 no date    │
└───────────────────────────────────────────────────────────────────────┘
┌ TOOLBAR ──────────────────────────────────────────────────────────────┐
│  [search] [Group: Status] [Filter] [Overdue 2]      ( Sprint │ Backlog)│
└───────────────────────────────────────────────────────────────────────┘
┌ BOARD ────────────────────────────────────────────────────────────────┐
│  To do · 5        │  In progress · 2      │  Done · 11                 │
└───────────────────────────────────────────────────────────────────────┘
```

Four bands. First card visible at roughly 250px.

## 4. Band 1 — one timeline slot, two modes

The slot holds **exactly one** timeline. Which one is a function of the URL:

- `?tab=roadmap` → `RoadmapSpine`, plus an **Edit schedule** link (admin) or
  **Full schedule** link (member)
- `?tab=roadmap&edit=schedule` → `RoadmapTimeline`, plus a **Done** link back

Mode in the URL, not client state, for the same reason sprint selection is
(previous spec §7): the page stays a server component and a view stays
linkable. `planHref` already carries every other param through, so switching
modes preserves the selected sprint, the zoom and the board's filters.

Consequences that fall out of this, all of them wanted:

- `defaultOpen={isAdmin}` disappears along with the disclosure. The
  never-two-timelines rule stops being a thing a prop can violate.
- The zoom control renders once. Whichever mode is showing owns it.
- `LazyDisclosure` existed here because a `<details>` that starts closed gives
  the timeline a zero-width box to scroll inside, so its scroll-to-today landed
  on the oldest sprint. In edit mode the timeline mounts into a real, visible,
  full-width box — the reason for the wrapper is gone, not worked around.
- The edit affordance is now a labelled button in the band it acts on, which is
  the actual fix for the problem `defaultOpen` was reaching for.

`New sprint` moves into this band's header: it is a schedule action and belongs
with the schedule, not floating in a control row of its own.

`SprintSwitcher` becomes a compact **All sprints ⌄** menu in the same header.
This is a deliberate, narrowed departure from previous spec §3 ("no dropdown"),
not an oversight: the argument that killed the dropdown was that a selector
standing *beside* the bars is a second control for one decision, and that
argument holds. A menu folded *inside* the spine's own header is not beside the
bars — it is the overflow of the same control, for the case §3 did not account
for, where an app has accumulated more sprints than the viewport can hold. It
occupies no band and it never renders a sprint name that a bar is also showing.

**No sprints at all:** the whole band does not render, as today.

## 5. Band 2 — the sprint header, one sticky line

New component: `src/features/sprints/components/sprint-header.tsx`.

It absorbs three surfaces that exist today:

1. the sprint card — name, status control, goal, date range
2. `PlanReadStrip` — the judgement sentence and its linkable chips
3. the `done / total` figure and its meter, taken out of `BoardToolbar`

Layout, two rows, collapsing to a stack under `sm`:

```
row 1   [name]  [status]   Aug 19–30 · 4d left      11/18  ▓▓▓░░ 61%      [Export] [Edit] [⋯]
row 2   goal, truncated to one line                 2 unassigned · 1 no date
```

Rules:

- **Sticky at `top-14`, `z-10`.** The app header is `sticky top-0 z-20 h-14`;
  this pins directly beneath it and must sit below it in the stacking order.
  Needs an opaque background — a translucent one over scrolling task cards is
  unreadable.
- **Numbers are `text-sm`, mono, `tabular-nums`.** Never `text-xl`. Hierarchy
  comes from weight and colour before size (previous spec §9). Deleting the
  giant stat row and re-introducing giant numbers here would change nothing.
- **Chips are `PlanReadStrip`'s existing markup and link logic**, reused, not
  reimplemented. The board already reads `who` and `overdue` out of the URL and
  no second filtering mechanism gets invented. `href: null` chips stay plain
  text for the same reason they are plain text today.
- **The health colour rule is unchanged**: the summary sentence carries
  `text-warning` / `text-destructive` / `text-success`, and the word is always
  present beside the colour.
- **Backlog** collapses this to a single line — "Backlog · tasks in no sprint"
  and the count. No dates, no meter, no invented health for a set that has none.

## 6. Band 3 — toolbar

**Delete the stat block entirely** (`board-toolbar.tsx`, the `Stat` component
and the row that uses it). §1 accounts for every number in it; each one keeps
the home nearer the work.

The standalone **Backlog** button becomes a **Sprint | Backlog** segmented
control at the end of the filter row. It switches which task set the board is
showing, which makes it a sibling of the filters, not of "New sprint."

That control links through `planHref`, not `boardHref`. `boardHref` rebuilds
the URL from scratch and drops the board's filters — the exact bug `planHref`'s
own doc comment was written about, still live on this one link. Switching to
Backlog while filtered to one person should keep that filter.

### The one number that has to stay down here

`BoardSummary` is computed over the **filtered** list, deliberately —
`board-view.ts` says so: *"a summary that counts tasks the columns below aren't
showing is worse than no headline."* Band 2 is a server component reading
`selectedRead`, which is the sprint's **unfiltered** truth. Those are two
different numbers and moving one into the other's place would silently corrupt
it.

So each scope keeps its own, labelled:

- **Band 2** shows the sprint's real progress — `11/18`. It is the *sprint's*
  header; the sprint has 18 tasks whatever the board is filtered to.
- **The toolbar** shows `showing 3 of 18` as small muted text, **only while a
  filter is active**. Unfiltered it renders nothing, because unfiltered the two
  numbers agree and the line would be noise.

That is one honest number per scope, each naming its own scope — not the five
unlabelled figures being deleted.

## 7. Band 4 — one empty state

- **Delete** the `tasks.length === 0` banner in `board.tsx`. Its headline is
  byte-identical to the page's own no-sprints banner, and it renders directly
  above three columns that each say the same thing again.
- **Unfiltered empty board:** the first column keeps the invitation
  ("Nothing here yet — add one below, or drag one over"). The other columns
  render a hairline, not a boxed sentence. One invitation, not three.
  `BoardColumn` takes an explicit prop for this; it does not infer "am I first"
  from an index it should not know about.
- **Filtered-empty** copy is unchanged and stays per column — a filtered column
  is telling you the work exists and is hidden, which is a different message
  that has to appear wherever the gap is.
- **No sprints at all:** the page's own banner is correct and stays. It is a
  genuinely different state and it is alone on screen when it renders.

## 8. States

| State | Result |
|---|---|
| Loading | unchanged. The route's `loading.tsx` is deliberately tab-agnostic (previous spec §6) and this redesign does not add the `<Suspense>` boundary that would let it be band-accurate. |
| Error | unchanged, per band. |
| No sprints | band 1 and band 2 do not render; the page's empty state is alone. |
| Sprint, no tasks | all four bands render; exactly one invitation, in the first column. |
| Backlog | band 1 renders with nothing selected; band 2 is the one-line backlog header. |
| Edit mode | band 1 is the full timeline; bands 2–4 unchanged beneath it. |

## 9. Not in scope

Task cards, the dnd wiring, column density, `roadmap-timeline.tsx` internals,
`board-bulk-bar.tsx`, `task-dialog.tsx`. This change is the composition of the
surface and the toolbar above the board — not the board's inside.

Also deliberately **not** done: no new palette, no new tokens, no chart, no
burndown. Previous spec §5 and §8 still hold.

## 10. Files

| File | Change |
|---|---|
| `src/app/(app)/apps/[slug]/page.tsx` | recompose the roadmap branch into four bands; parse `edit=schedule`; drop the disclosure and the standalone control row |
| `src/features/sprints/components/sprint-header.tsx` | **new** — band 2 |
| `src/features/sprints/components/board-toolbar.tsx` | delete `Stat` and the stat row; add the Sprint\|Backlog segment |
| `src/features/sprints/components/board.tsx` | delete the duplicate empty banner |
| `src/features/sprints/components/board-column.tsx` | empty-state variant prop |
| `src/features/sprints/components/plan-read-strip.tsx` | reused inside band 2 |
| `src/components/shared/lazy-disclosure.tsx` | becomes unreferenced — confirm no other worktree has claimed it before removing; leaving dead code is not the default |

## 11. Build order

1. `sprint-header.tsx` with its states, against the existing `SprintRead` /
   `PlanGaps` types. No page changes yet.
2. Band 1 mode swap in `page.tsx`; disclosure out.
3. Toolbar: stat row out, segmented control in.
4. Empty states: `board.tsx` banner out, `board-column.tsx` variant in.
5. Sticky offsets and the vertical budget, measured, not assumed.
6. Verify: `tsc`, lint, tests, build; then the keyboard path end to end —
   spine bar → Edit schedule → Done → toolbar → column → card.
