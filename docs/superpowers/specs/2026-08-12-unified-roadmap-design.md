# Unified Roadmap — design

**Date:** 2026-08-12
**Replaces:** the app detail page's separate `Board` and `Roadmap` tabs.

## 1. The problem with two tabs

A board answers *"what is happening right now, and who has it."*
A roadmap answers *"when does it land, and in what order."*

Those are two halves of one question — **"are we going to make it?"** — and today
you cannot hold both at once. The same tasks appear in both places under two
different mental models, so:

- The board has no time in it. A sprint ending on Friday with eleven cards in
  *To do* looks exactly like one ending in three weeks.
- The roadmap has no work in it. A sprint bar is a rectangle between two dates;
  whether it is 10% done or 90% done is invisible until you leave and switch tabs.
- Deciding anything requires holding one tab in your head while looking at the
  other.

Merging them is not about saving a tab. It is about making the question
answerable on one screen.

## 2. The single job

> **This app's plan: what is scheduled, how it is actually going, and what to move.**

Everything on the surface must serve that sentence. Anything that does not is cut.

## 3. The shape

One surface, one spine of time, two levels of detail:

```
┌─ SPINE ────────────────────────────────────────────────────────────┐
│  ← past      [ Sprint 4 ]  [ Sprint 5 ▸running ]  [ Sprint 6 ]     │  schedule AND selector
│  each bar: dates · progress fill · today marker                     │
└────────────────────────────────────────────────────────────────────┘
┌─ READ ─────────────────────────────────────────────────────────────┐
│  4 days left · 11 of 18 done · 2 people over capacity · 1 gap       │  the judgement line
└────────────────────────────────────────────────────────────────────┘
┌─ WORK ──────────────────┬──────────────────┬──────────────────────┐
│  To do                  │  In progress     │  Done                │  the selected window
│  [card] [card]          │  [card]          │  [card]              │
└─────────────────────────┴──────────────────┴──────────────────────┘
┌─ UNSCHEDULED ──────────────────────────────────────────────────────┐
│  backlog, draggable into a column                                   │
└────────────────────────────────────────────────────────────────────┘
```

**The spine is the navigation.** Selecting a sprint on the timeline *is*
selecting the board below it. There is no second control, no tab, no dropdown —
the schedule and the selector are the same object. That is the whole idea.

## 4. Signature element

**The sprint bar that shows its own progress.** Each bar on the spine is filled
proportionally to work completed and marked at today's position, so the gap
between *how far through the time we are* and *how far through the work we are*
is a visible distance on screen rather than two numbers to compare in your head.
A bar whose fill trails its today-marker is behind, and it looks behind.

The fill belongs to the SPRINT BAR, wherever a sprint bar is drawn — the spine
and the full timeline both get it, because a bar that shows progress in one
place and not the other teaches people that the mark is decorative. Nothing
that is not a sprint bar gets a fill: the bar is the one place colour carries a
quantity.

The two surfaces render it differently for one reason. The spine's fill is
scored on health and coloured by it, because the spine's whole job is the
time-versus-work read. The timeline's bars are already coloured by sprint
STATUS (planned / active / done) and cannot take a second colour language, so
their fill is drawn in `currentColor` at low alpha — a lightness step inside
whatever colour the status gave the bar, which survives all three treatments in
both themes. Both are the same quantity from the same `readSprint`, and both
carry the health word beside them so the fill is never colour alone.

## 5. Intelligence — only what changes a decision

Four reads, each derived from data that already exists, each one actionable:

| Read | Source | Why it earns its place |
|---|---|---|
| Time left vs work left | `sprints.endDate`, task status counts | The core "will we make it" |
| People over capacity | `assignments.allocationPct` per assignee | Says *who* to move work off |
| Check-in gap | `sprintCheckins.percent` vs board-derived % | Self-report disagreeing with the board is the earliest warning there is |
| Unassigned / undated work | `tasks.assigneeId`, `tasks.dueDate` null | Work nobody owns is the most common way a sprint slips |

Each read links to the thing it is about. A number that cannot be clicked
through to its cause is a decoration.

**Not included** (deliberately): burndown charts, velocity forecasts, predicted
completion dates. This team has no historical velocity worth extrapolating from,
and a projection presented with false confidence is worse than no projection.

## 6. States (every one designed)

- **Loading** — ~~skeleton matching the three bands (spine, read, columns)~~.
  **Superseded during implementation.** The route's existing `loading.tsx` is
  deliberately tab-agnostic, and its own comment explains why: a skeleton cannot
  read `?tab=`, so painting this surface's bands would flash a spine at somebody
  opening Discussion — the exact bug that skeleton was rewritten to remove. It
  promises the shell only, and that stays. A band-accurate skeleton needs
  `<Suspense>` around the plan's own subtree (which would also finally give
  `BoardSkeleton` its first call site); not done here.
- **No sprints yet** — the spine collapses to a single "Plan the first sprint"
  action; the board still renders the app's unscheduled work, because tasks can
  exist before any sprint does.
- **Sprint with no tasks** — columns render with an empty state offering
  "Add the first task", not a blank grid.
- **Nothing unscheduled** — the rail hides entirely rather than showing an empty box.
- **Error** — inline, with retry, per band; a failed check-in read must not blank
  the board.

## 7. Interaction rules

- Selection lives in the URL (`?tab=roadmap&sprint=<id>`), so a view is linkable
  and the page stays a server component. Same rule the rest of the app follows.
- Drag stays exactly as it is on the board today — same dnd-kit wiring, same
  permission gate, same optimistic update. This redesign changes what surrounds
  the drag, not the drag.
- Every drag target is reachable without a mouse: moving a card between columns
  and scheduling a backlog item both keep their existing keyboard path.
- The spine scrolls horizontally in its own container; the page never scrolls
  sideways.

## 8. Avoided defaults

- **Not** a Gantt chart with dependency arrows. Nothing in this product records a
  dependency, so arrows would be decoration pretending to be data.
- **Not** a swimlane-per-person board. It reads as a leaderboard and buries the
  question the surface exists to answer.
- **Not** a burndown line. See §5.
- **Not** two panes with a splitter. A resizable split is a way of refusing to
  decide which thing matters at which moment; the spine → board hierarchy decides.
- **No new palette.** The existing tokens carry everything: `--primary` for
  progress, `--warning` for at-risk, `--destructive` for over capacity,
  `--muted-foreground` for structure. Raw hex anywhere in this work is a defect.

## 9. Type and data conventions

- Sprint names and card titles: body sans.
- Every date, percentage, day count and card count: mono with `tabular-nums`
  (the repo's existing `PCT_CLASS` convention), so columns of numbers do not
  jitter as they update.
- Hierarchy from weight and colour before size — the spine's sprint names are the
  same size as the board's card titles, distinguished by weight.

## 10. Build order

1. Pure derivation module + tests (progress, time-vs-work risk, check-in gap).
2. The spine component (presentational, server-safe).
3. The read strip.
4. Wire the existing board underneath, unchanged internally.
5. Retire the `board` tab id; redirect old `?tab=board` links.
6. Verify: tsc, lint, tests, build → three review lenses.
