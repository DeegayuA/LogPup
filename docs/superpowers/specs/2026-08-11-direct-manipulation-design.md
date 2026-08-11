# Direct Manipulation — Sprint Board, Roadmap & Meetings Calendar

Date: 2026-08-11 · Branch: main · Owner: this session (`src/features/sprints/**`,
`src/features/meetings/components/meetings-month-calendar.tsx`, plus new shared files)

## Goal

Cards across the sprint board, the app roadmap and the meetings calendar become
clickable, draggable, movable and editable — sharing one drag kit (sensors,
overlay pattern, accessibility announcements) instead of three divergent
implementations. Follows the "watchdog calm" design system
(`docs/superpowers/specs/2026-08-11-ui-redesign-design.md`) — tokens only, no
raw hex/oklch; shadcn primitives here are Base UI flavored (`render={<.../>}`,
not `asChild`).

## Why a shared kit

The board (`board.tsx`) and calendar (`meetings-month-calendar.tsx`) each
already have a working `PointerSensor` + `DndContext` setup, but:
- `PointerSensor` claims touch, so it can't be given different mouse vs. touch
  activation constraints — this is why a touch drag on either surface today
  fights the page scroller instead of lifting the card/chip.
- Neither has keyboard drag.
- The board's drag transform runs in-place inside an `overflow-x-auto` row,
  so dragging toward the third column clips at the scroller edge (no
  `DragOverlay`). The calendar already solved this with a portalled
  `DragOverlay` (`meetings-month-calendar.tsx:355-365`) — that pattern moves
  to the shared kit and the board adopts it too.
- The roadmap has no interactivity at all today: it's a static server
  component, rows are plain links.

## Phase 1 — shared drag kit

**`src/lib/sort-order.ts`** (new, pure). `SORT_GAP` + `sortOrderForIndex`
lifted verbatim from `board.tsx:22-69`, generalized to any
`{ sortOrder: number }[]` so both the board (tasks) and the roadmap (sprints)
can share one fractional-midpoint-with-fallback strategy. Unit tests cover:
first/last/only item, a real midpoint, and the "midpoint exhaustion" case
(adjacent sortOrders 1 apart, `mid` collapses onto a neighbor) that forces the
`(index + 1) * SORT_GAP` fallback.

**`src/components/shared/drag-surface.tsx`** (new client component).
- `useDragSensors()`: `MouseSensor` (`activationConstraint: { distance: 8 }`,
  so a plain click still opens) + `TouchSensor` (`{ delay: 200, tolerance: 8 }`,
  long-press to drag so a plain swipe scrolls) + `KeyboardSensor`
  (`keyboardCodes: { start: ['Space'] }` only — `Enter` stays free for "open").
  Replaces `PointerSensor` everywhere; that's the fix for touch fighting the
  scroller, since Mouse/Touch can now have independent activation.
- `<DragSurface>`: thin wrapper around `<DndContext sensors={...} {...rest}>`
  — owns the sensor set, passes through every other `DndContext` prop
  (`onDragStart/Move/End/Cancel`, `accessibility`, `modifiers`, collision
  detection) so each surface keeps its own drag logic.
- `buildDragAnnouncements(nameForId)`: generalizes the calendar's
  `announcements` object (`meetings-month-calendar.tsx:161-179`) to take one
  "name this id" function instead of being hardcoded to meeting titles/day
  keys — the board names task titles + column titles, the roadmap names
  sprint names + a spoken date range.

## Phase 2 — board fixes

- `board.tsx` moves onto `<DragSurface>` and adds a portalled `<DragOverlay>`
  (`dropAnimation={null}`, same as the calendar) showing a `TaskCardFace` —
  the presentational half of `TaskCard` extracted so the overlay can render
  the same visual without the sortable wiring. The original card keeps
  dnd-kit's own pointer-transform (so siblings still reflow) but drops to
  `opacity-40` while dragging, so it reads as a ghost trailing the overlay
  copy that now actually follows the pointer past the scroller edge.
- `task-card.tsx`: open-on-keyboard narrows to `Enter` only (Space is now the
  shared kit's drag-start key). Adds an `aria-hidden` `GripVertical`
  affordance, `opacity-0` → `opacity-100` on hover/focus, only when
  `draggable`.
- A one-line hint above the board names the keyboard route, mirroring the
  calendar's existing hint (`meetings-month-calendar.tsx:300-303`).
- `moveTask` and the optimistic path (`useOptimistic` + try/catch + toast) are
  unchanged.

## Phase 3 — live roadmap

`roadmap.tsx` becomes a client component. Each row splits into two
independent drag surfaces so nothing conflicts:
- **Label cell**: stays the `Link` to the board, plus a small grip *button*
  that's the actual sortable drag handle (`useSortable`'s `setActivatorNodeRef`
  pattern — the row's outer element gets `setNodeRef` so it still
  reflows/animates, but only the grip button gets the listeners, so the Link
  underneath stays a plain, fully-clickable link).
- **Bar**: three independent `useDraggable` registrations on the *same* row,
  disambiguated by id suffix so they can coexist in one `DndContext` without
  colliding with the reorder grip's bare `sprintId`:
  - `${sprintId}:shift` — the bar body, horizontal-locked drag (move both
    dates, same duration).
  - `${sprintId}:start` / `${sprintId}:end` — 8px edge handles, revealed on
    row hover/focus, `cursor-ew-resize`, resize one edge with a clamped
    1-day-minimum duration.
  A single inline modifier on the roadmap's `<DragSurface modifiers={...}>`
  locks `y: 0` for any id ending `:shift`/`:start`/`:end` and leaves the bare
  reorder id (grip) unlocked — `({ transform, active }) => …`, no
  `@dnd-kit/modifiers` dependency added.

`src/features/sprints/roadmap-geometry.ts` (new, pure) owns all px↔date math,
mirroring `sprint-date-range.ts`'s "parse to UTC y/m/d, do the math, format
back" pattern so it can't drift a day by timezone:
- `PX_PER_DAY` (moved out of `roadmap.tsx`, now the single source).
- `daysFromOffset(px) = Math.round(px / PX_PER_DAY)`.
- `shiftRange(start, end, days)` — moves both dates, same duration.
- `resizeStart(start, end, days)` / `resizeEnd(start, end, days)` — clamped so
  an edge can't cross its opposite (1-day minimum). Unit tests cover the
  clamp (dragging an edge past its opposite), a zero-day drag (no-op), and
  normal shift/resize.

**Migration `0019_sprint_sort_order.sql`** (renumbered twice mid-task as
`main` kept moving — the coordinator's original `0016` was claimed by a
parallel session; by the time this was caught `main` had `0016` for real
(`assignment_history_one_open`) and later gained `0017`
(`meeting_recording_segments`) too, mid-session, requiring a second re-pull
and regeneration. `0018` is reserved for another in-flight agent, so this
lands at `0019` with a deliberate gap — same as the existing `0010` → `0012`
gap already in this repo's history. Generated via `npx drizzle-kit generate`
against `main` pulled into this worktree (not hand-written), each time
re-run after re-merging `main` so the snapshot's `prevId` chains off
whatever `main`'s actual latest migration was, then renamed and hand-edited
to add the `IF NOT EXISTS` guard and the chronological backfill drizzle-kit
doesn't generate on its own — replay-safe (`sort_order = 0` guard, no-op on
replay and on any row a human has already reordered):

```sql
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
UPDATE sprints s SET sort_order = r.rn * 1024
FROM (SELECT id, row_number() OVER (PARTITION BY app_id ORDER BY start_date, id) AS rn FROM sprints) r
WHERE s.id = r.id AND s.sort_order = 0;
```

`schema.ts` gets `sortOrder: integer('sort_order').notNull().default(0)` on
`sprints`; `getSprintsForApp` orders by `sortOrder` (was `desc(startDate)`) so
nothing visibly moves on day one — the seed is chronological. `page.tsx`'s
board-tab default-sprint fallback and the sprint switcher dropdown, which used
to lean on `getSprintsForApp`'s old newest-first order, now sort explicitly by
`startDate` themselves so that default didn't silently regress to
"oldest/lowest-`sortOrder` sprint" once row order became independent of dates.
`drizzle/meta/0019_snapshot.json` was produced by `drizzle-kit generate`
itself (then renamed alongside the `.sql` file), so it chains correctly off
`0016`'s snapshot id — confirmed by re-running `drizzle-kit generate`
afterward, which reports "No schema changes, nothing to migrate."

**Two new admin-only server actions** in `actions.ts`, matching the existing
`requireAdmin()` shape:
- `updateSprintDates(sprintId, startDate, endDate)` — validates `end >= start`.
- `reorderSprint(sprintId, sortOrder)`.
- `resortSprintsByDate(appId)` — reseeds `sortOrder` chronologically (same
  `row_number() OVER (...)` idea as the migration, expressed as a query), for
  a "Sort by date" button in the roadmap header.

All three wrapped in `useOptimistic` + try/catch + toast in `roadmap.tsx`,
exactly like `board.tsx:129-145`, so a rejected move snaps back instead of
lying. Non-admins get **no** drag affordances at all: no grip, no edge
handles, `cursor-default` — mirrors `canMoveTask`'s all-or-nothing gate on the
board, gated here on `isAdmin` since only admins may touch sprint dates.

**Keyboard**: focus the bar (not the whole row) — `Left`/`Right` shifts one
day, `Shift+Left/Right` a week, `Alt+Up/Down` reorders the row via
`sortOrderForIndex` against the neighbor in that direction. This is a plain
`onKeyDown` handler on the bar, independent of the shared `KeyboardSensor`
(which stays reserved for Space-to-pick-up pointer-style drags elsewhere) —
the direct-nudge model here doesn't need a pick-up step. Nudges debounce
400ms into one write (a ref-held timer + pending local state), so holding an
arrow key is one `updateSprintDates` call, not thirty. Resize has no keyboard
route; the UI hint says so honestly and points at the sprint dialog instead
of implying a keyboard affordance that doesn't exist.

A live tooltip follows the `DragOverlay` during a shift/resize, computed from
`onDragMove`'s running `delta.x` through the same `roadmap-geometry`
functions used on drop, so what's shown while dragging is exactly what will
be saved.

## Phase 4 — calendar refit

`meetings-month-calendar.tsx` moves onto `<DragSurface>` (shared sensors) —
gains keyboard drag and long-press touch for free. Its existing
`announcements`, `DragOverlay`, and past/dashed-border a11y treatment are
preserved as-is (already good, not touched). Clicking an empty area of a day
cell opens `MeetingForm` prefilled with that date — `MeetingForm` gains an
optional `defaultStart` prop and an optional controlled `open`/`onOpenChange`
pair (falls back to its existing internal-state/`trigger` behavior when
omitted, so `meetings/page.tsx`'s existing usage is unaffected). `apps` and
`activeUsers` — already fetched in `meetings/page.tsx` — thread through
`MeetingsViews` → `MeetingsMonthCalendar` so the calendar can mount the form.

## Phase 5 — inline edit

**`src/components/shared/inline-rename.tsx`** (new). Double-click or `F2`
swaps text for an input; `Enter` saves, `Esc` cancels, blur saves; optimistic
via a caller-supplied `onSave` + local pending state. Used for task card
titles (`updateTask`) and roadmap sprint names (new minimal rename path
through the existing sprint update surface, or `updateTask`-style direct
field — see implementation for exact wiring).

**`src/components/shared/card-quick-menu.tsx`** (new). Built on the existing
`src/components/ui/dropdown-menu.tsx` (Base UI `Menu`). Opens on right-click
(`onContextMenu`) and from a hover/focus-revealed trigger button (`⋯`).
Items are permission-filtered per caller — the board card offers assignee,
priority, move-to-status, open, delete (admin, via `requireAdmin`); the
roadmap row offers edit dates, status, open board, delete. Board items beyond
"open" respect `canMoveTask` (admin, or the assignee) from
`src/features/sprints/permissions.ts`; destructive items require
`requireAdmin` on the server regardless of what the client shows.

## Testing / Verification

- `npx tsc --noEmit` and `npm test` (vitest) must both be clean/green.
- New pure modules (`sort-order.ts`, `roadmap-geometry.ts`) get unit tests,
  including the clamp and midpoint-exhaustion edge cases.
- **Migration replay**: no local Postgres, Docker, or `psql` is available in
  this sandbox, but `npm install` has network access, so verification uses
  `@electric-sql/pglite` (installed with `--no-save`, not a project
  dependency) instead of skipping the check. A throwaway script: (1) replays
  the full `0000..0019` chain once on a fresh DB — all 17 files applied
  without error; (2) seeds two apps with five sprints inserted in
  deliberately non-chronological order, runs `0019` alone, and confirms
  `sort_order` comes out `1024`/`2048`/`3072` per app in start-date order;
  (3) re-runs `0019` a second time on that same, now-migrated DB (simulating
  this project's known-unreliable `__drizzle_migrations` bookkeeping
  re-applying a file) and confirms zero errors and byte-identical
  `sort_order` values; (4) manually sets one row's `sort_order` to `500`
  (simulating a human drag-reorder) and re-runs `0019` a third time,
  confirming that row is left untouched. All checks passed. This does not
  test individual replayability of migrations `0000`–`0016` — the
  coordinator flagged that as a known, pre-existing, out-of-scope issue
  (most of those files use bare `CREATE TABLE`/`ADD COLUMN` with no replay
  guard), and this task didn't touch or attempt to fix them.
- Keyboard interaction (Tab to a card/bar, Space to lift, arrow nudges,
  Enter/Escape) is exercised via a running dev server, not assumed from
  reading dnd-kit's docs.
- No changes to `moveTask`, `meeting-intel.tsx`, `note-timeline.tsx`,
  `notes.ts`, or `ai-actions.ts`.
