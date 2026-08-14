# Roadmap Surface Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the app Roadmap tab from nine restating bands into four, so the board's first card is visible without scrolling.

**Architecture:** The timeline gets one slot with two URL-driven modes (spine for reading, full timeline for editing) instead of two components rendered at once. The sprint card, the read strip and the toolbar's stat row merge into one sticky sprint header. Every number keeps exactly one home, nearest the work it describes. The page stays a server component; mode and selection both live in the URL.

**Tech Stack:** Next.js App Router (server components), React 19, Tailwind, vitest, dnd-kit (untouched).

**Spec:** [docs/superpowers/specs/2026-08-13-roadmap-redesign-design.md](../specs/2026-08-13-roadmap-redesign-design.md)

## Global Constraints

- **Read a file before editing it.** Parallel sessions edit this tree constantly. Stage explicit paths — never `git add -A`, `commit -a`, `reset --hard`, `checkout -- .`, or `git stash`.
- **No new palette, no raw hex.** Existing tokens only: `--primary` progress, `--warning` at-risk, `--destructive` overdue, `--muted-foreground` structure. Raw hex anywhere in this work is a defect.
- **Colour is never the only signal.** Wherever a health colour is painted, `HEALTH_WORD[health]` is painted beside it (WCAG 1.4.1 — "behind" vs "overdue" is exactly the pair a red-green reader loses).
- **Every date, percentage, day count and card count** renders mono with `tabular-nums`. **None of them renders at `text-xl` or larger** — hierarchy comes from weight and colour before size.
- **This repo has zero component tests** (`find src -name '*.test.tsx'` → 0). Do not introduce React Testing Library. TDD applies to the pure functions this plan extracts; layout changes are verified by `tsc`, lint, `npm run test`, `npm run build`, and the manual passes in Task 6.
- **Commands:** test `npm run test`, lint `npm run lint`, build `npm run build`, types `npx tsc --noEmit`.
- **Do not touch:** `task-card.tsx`, `task-dialog.tsx`, `board-bulk-bar.tsx`, dnd-kit wiring, `roadmap-timeline.tsx` internals.

---

### Task 1: Schedule mode, parsed from the URL

The band-1 mode has to be a parsed URL value, not client state, so the page stays a server component and a view stays linkable. Modelled on `parseZoom` in `roadmap-layout.ts`, which does the identical job for the timeline scale.

**Files:**
- Create: `src/features/sprints/schedule-mode.ts`
- Test: `src/features/sprints/schedule-mode.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type ScheduleMode = 'read' | 'edit'`; `parseScheduleMode(raw: string | null | undefined): ScheduleMode`; `const SCHEDULE_EDIT_PARAM = 'schedule'`.

- [ ] **Step 1: Write the failing test**

Create `src/features/sprints/schedule-mode.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SCHEDULE_EDIT_PARAM, parseScheduleMode } from './schedule-mode'

describe('parseScheduleMode', () => {
  it('defaults to read', () => {
    expect(parseScheduleMode(undefined)).toBe('read')
    expect(parseScheduleMode(null)).toBe('read')
    expect(parseScheduleMode('')).toBe('read')
  })

  it('recognises the edit value', () => {
    expect(parseScheduleMode(SCHEDULE_EDIT_PARAM)).toBe('edit')
  })

  // A stale or hand-typed value must not blank the timeline slot: an
  // unrecognised mode falls back to the readable one, exactly as parseZoom
  // falls back to month rather than rendering nothing.
  it('falls back to read on nonsense', () => {
    expect(parseScheduleMode('gantt')).toBe('read')
    expect(parseScheduleMode('EDIT')).toBe('read')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- schedule-mode`
Expected: FAIL — `Failed to resolve import "./schedule-mode"`.

- [ ] **Step 3: Write the implementation**

Create `src/features/sprints/schedule-mode.ts`:

```ts
// Which timeline the plan's first band is showing.
//
// ONE slot, two modes — never both timelines at once. The previous surface
// rendered the spine AND the full timeline together (a disclosure with
// `defaultOpen={isAdmin}`), which is the duplication the unified-roadmap spec
// §8 exists to forbid. Making the choice a parsed URL value rather than a
// prop or client state means the rule cannot be violated by a boolean.
//
// Same shape as parseZoom in roadmap-layout.ts, deliberately: unrecognised
// input falls back to the readable default rather than rendering nothing.

export type ScheduleMode = 'read' | 'edit'

/** The `?edit=` value that opens the editable timeline. */
export const SCHEDULE_EDIT_PARAM = 'schedule'

export function parseScheduleMode(raw: string | null | undefined): ScheduleMode {
  return raw === SCHEDULE_EDIT_PARAM ? 'edit' : 'read'
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- schedule-mode`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/sprints/schedule-mode.ts src/features/sprints/schedule-mode.test.ts
git commit -m "feat: parse the roadmap's schedule mode from the URL"
```

---

### Task 2: The shared short day-count label

Band 2's first row wants a compact "4d left". `roadmap-spine.tsx` already has a private `remainingLabel` producing exactly that string, and `plan-read.ts` has a private `daysLeftPhrase` producing the long form. Writing a third copy in the new header is how two surfaces describing one sprint start disagreeing about it — the exact failure the `HEALTH_WORD` comment in `plan-read.ts` warns about.

So: promote the short form into `plan-read.ts`, next to the long one, and have the spine import it.

**Files:**
- Modify: `src/features/sprints/plan-read.ts` (add export beneath `completionCount`, which ends at line 96)
- Modify: `src/features/sprints/components/roadmap-spine.tsx:93-99` and `:276`
- Test: `src/features/sprints/plan-read.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `remainingLabelShort(remainingDays: number): string` — `'ends today'` when `<= 0`, otherwise `` `${n}d left` ``.

- [ ] **Step 1: Write the failing test**

Append to `src/features/sprints/plan-read.test.ts`. Add `remainingLabelShort` to the existing import from `./plan-read`, then:

```ts
describe('remainingLabelShort', () => {
  it('counts whole days left', () => {
    expect(remainingLabelShort(4)).toBe('4d left')
    expect(remainingLabelShort(1)).toBe('1d left')
  })

  // `remainingDays` is "end − today", so 0 means the sprint ends TODAY rather
  // than that it is out of time. "0d left" about a day somebody still has to
  // work in reads as a deadline already missed.
  it('says ends today at zero', () => {
    expect(remainingLabelShort(0)).toBe('ends today')
  })

  it('never renders a negative count', () => {
    expect(remainingLabelShort(-3)).toBe('ends today')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- plan-read`
Expected: FAIL — `remainingLabelShort is not a function`, or an import error.

- [ ] **Step 3: Write the implementation**

In `src/features/sprints/plan-read.ts`, directly beneath `completionCount`:

```ts
/**
 * Days left, in the compact form a bar label and a header line both need.
 *
 * The long form lives in `daysLeftPhrase` below and reads "4 days left"; this
 * is the same fact at chip width. Both are here rather than in whichever
 * component happens to want one, because a third private copy is how two
 * surfaces describing the same sprint start disagreeing about the day it ends
 * — the same argument HEALTH_WORD makes above.
 *
 * 0 means the sprint ends TODAY, not that it is out of time.
 */
export function remainingLabelShort(remainingDays: number): string {
  return remainingDays <= 0 ? 'ends today' : `${remainingDays}d left`
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- plan-read`
Expected: PASS, including the 3 new assertions.

- [ ] **Step 5: Delete the spine's private copy**

In `src/features/sprints/components/roadmap-spine.tsx`, delete lines 93-99 (the `remainingLabel` doc comment and function). Add `remainingLabelShort` to the existing import from `@/features/sprints/plan-read` (the block at lines 16-21). Change the call site at line 276 from:

```tsx
{progress.phase === 'running' ? ` · ${remainingLabel(progress)}` : null}
```

to:

```tsx
{progress.phase === 'running' ? ` · ${remainingLabelShort(progress.remainingDays)}` : null}
```

- [ ] **Step 6: Verify nothing else referenced the private helper**

Run: `grep -rn "remainingLabel\b" src`
Expected: no matches — only `remainingLabelShort` remains.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/sprints/plan-read.ts src/features/sprints/plan-read.test.ts src/features/sprints/components/roadmap-spine.tsx
git commit -m "refactor: one definition of the short days-left label"
```

---

### Task 3: The sprint header (band 2)

One sticky line replacing three surfaces: the sprint card (`page.tsx:453-476`), `PlanReadStrip`, and the `done/total` block taken out of `BoardToolbar` in Task 5.

This task builds the component only. It is wired into the page in Task 4, so at the end of this task the app renders exactly as before and the new file is unreferenced — that is expected, not a mistake.

**Files:**
- Create: `src/features/sprints/components/sprint-header.tsx`
- Read first, do not modify: `src/app/(app)/apps/[slug]/page.tsx:61-72` (the status maps this renders through a slot), `src/features/sprints/components/plan-read-strip.tsx` (the chips this reuses)

**Interfaces:**
- Consumes: `SprintRead`, `PlanGaps`, `completionCount`, `remainingLabelShort` (Task 2) from `@/features/sprints/plan-read`; `PlanReadStrip` from `@/features/sprints/components/plan-read-strip`.
- Produces: `SprintHeader` — a server component with exactly these props:

```ts
{
  sprint: {
    id: string
    name: string
    goal: string | null
    startDate: string
    endDate: string
    status: 'planned' | 'active' | 'done'
  } | null          // null in backlog mode
  read: SprintRead | null   // null in backlog mode
  gaps: PlanGaps
  checkinGapCount: number
  backlogCount: number      // only read when `sprint` is null
  boardHrefFor: (params: Record<string, string>) => string
  statusSlot: ReactNode     // status select (admin) or badge — keeps this server-side
  actions: ReactNode        // export / overflow buttons
}
```

- [ ] **Step 1: Create the component**

Create `src/features/sprints/components/sprint-header.tsx`:

```tsx
import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { parseCalendarDate } from '@/lib/working-days'
import { PlanReadStrip } from '@/features/sprints/components/plan-read-strip'
import {
  completionCount,
  remainingLabelShort,
  type PlanGaps,
  type SprintRead,
} from '@/features/sprints/plan-read'

/**
 * Band 2: everything true about the SELECTED sprint, on one line.
 *
 * It replaces three stacked surfaces that each restated the other two — a
 * sprint card, a read strip, and a five-figure stat row whose every number
 * already existed somewhere closer to the work. See the redesign spec §1.
 *
 * WHY THE NUMBERS HERE ARE UNFILTERED, AND WHY THAT IS NOT A BUG
 * `BoardSummary` is computed over the FILTERED list on purpose — board-view.ts
 * says a headline counting cards the columns aren't showing is worse than no
 * headline. This is not that headline. This is the SPRINT's header: the sprint
 * has 18 tasks whatever the board below is filtered to, and `read` is the
 * sprint's own unfiltered truth. The toolbar keeps the filtered figure as
 * "showing 3 of 18", and only while a filter is active. One honest number per
 * scope, each naming its scope.
 *
 * STICKY AT top-14, NOT top-0: the app shell's header is `sticky top-0 z-20
 * h-14`, so this pins directly beneath it and must sit BELOW it in the
 * stacking order. The background is opaque — a translucent one over scrolling
 * task cards is unreadable — and the wrapper bleeds to the page edges so
 * nothing slides past its sides.
 *
 * Server component: it holds no state. The status control and the action
 * buttons are client components, passed in as slots.
 */
export function SprintHeader({
  sprint,
  read,
  gaps,
  checkinGapCount,
  backlogCount,
  boardHrefFor,
  statusSlot,
  actions,
}: {
  sprint: {
    id: string
    name: string
    goal: string | null
    startDate: string
    endDate: string
    status: 'planned' | 'active' | 'done'
  } | null
  read: SprintRead | null
  gaps: PlanGaps
  checkinGapCount: number
  backlogCount: number
  boardHrefFor: (params: Record<string, string>) => string
  statusSlot: ReactNode
  actions: ReactNode
}) {
  return (
    <div className="sticky top-14 z-10 -mx-6 bg-background px-6 py-2">
      {sprint && read ? (
        <div className="flex flex-col gap-1.5 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="font-heading text-base font-semibold">{sprint.name}</h2>
            {statusSlot}

            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {format(parseCalendarDate(sprint.startDate), 'MMM d')} –{' '}
              {format(parseCalendarDate(sprint.endDate), 'MMM d, yyyy')}
              {read.progress.phase === 'running'
                ? ` · ${remainingLabelShort(read.progress.remainingDays)}`
                : null}
            </span>

            {/* Progress, once. text-xs, not text-xl: the stat row this
                replaces made the biggest type on the page a set of zeroes. */}
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium tabular-nums">
                {completionCount(read)}
              </span>
              <span aria-hidden className="h-1 w-20 overflow-hidden rounded-full bg-border">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${read.donePct}%` }}
                />
              </span>
              <span className="font-mono text-2xs text-muted-foreground tabular-nums">
                {read.donePct}%
              </span>
            </span>

            <div className="ml-auto flex items-center gap-2">{actions}</div>
          </div>

          {/* Row 2: the judgement sentence and its drill-down chips, reused
              wholesale. The board already reads `who` and `overdue` out of the
              URL; no second filtering mechanism gets invented here. */}
          <PlanReadStrip
            read={read}
            gaps={gaps}
            checkinGapCount={checkinGapCount}
            boardHrefFor={boardHrefFor}
            className="bg-transparent px-0 py-0 ring-0"
          />

          {sprint.goal ? (
            <p className="truncate text-sm text-muted-foreground" title={sprint.goal}>
              {sprint.goal}
            </p>
          ) : null}
        </div>
      ) : (
        /* Backlog: no dates, no meter, no invented health. A set with no
           schedule has no read, and drawing an empty progress bar for it
           would state something false. */
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
          <h2 className="font-heading text-base font-semibold">Backlog</h2>
          <p className="text-sm text-muted-foreground">
            Tasks in no sprint. <span className="font-mono tabular-nums">{backlogCount}</span>{' '}
            {backlogCount === 1 ? 'task' : 'tasks'}.
          </p>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Confirm `parseCalendarDate`'s import path**

Run: `grep -n "parseCalendarDate" "src/app/(app)/apps/[slug]/page.tsx"`

Copy the import path that file already uses. If it differs from `@/lib/working-days`, fix the import above to match it — do not add a second source for the same helper.

- [ ] **Step 3: Confirm `PlanReadStrip` accepts the flattening className**

Read `plan-read-strip.tsx:74-80`. It composes `className` through `cn()` *after* its own classes, and this repo's `cn` is `clsx` + `tailwind-merge`, so later utilities win — `bg-transparent px-0 py-0 ring-0` should flatten the nested card.

Verify it visually in Task 6. If it does not flatten, drop the `className` prop entirely and accept a nested card rather than reaching into `PlanReadStrip` to restructure it — that component is shared.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors. The file is unreferenced at this point; that is expected.

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/sprints/components/sprint-header.tsx
git commit -m "feat: one sticky sprint header for the roadmap surface"
```

---

### Task 4: Recompose the page into four bands

The structural task. Band 1 becomes one slot with two modes; band 2 becomes `SprintHeader`; the standalone control row, the old sprint card, the loose `PlanReadStrip` and the `LazyDisclosure` all go.

**Files:**
- Modify: `src/features/sprints/components/roadmap-spine.tsx` (add an `actions` slot to the header row at lines 164-187)
- Modify: `src/app/(app)/apps/[slug]/page.tsx` — imports (37, 47-53), `planHref` param list (221), a new derived value near 231, and the whole roadmap branch (408-545)

**Interfaces:**
- Consumes: `parseScheduleMode`, `SCHEDULE_EDIT_PARAM` (Task 1); `SprintHeader` (Task 3).
- Produces: `RoadmapSpine` gains `actions?: ReactNode`. `Board` is called with a new `isBacklog` prop that Task 5 adds to its signature — expect a type error between the two tasks.

- [ ] **Step 1: Give the spine an actions slot**

In `roadmap-spine.tsx`, add `actions?: ReactNode` to the props type and destructuring, and `import type { ReactNode } from 'react'` at the top. Then wrap the existing zoom nav (lines 168-186) so the slot sits beside it:

```tsx
        <div className="flex items-center gap-2">
          {actions}
          <nav aria-label="Timeline scale" className="flex items-center gap-1">
            {/* …the ZOOM_LEVELS.map block, unchanged… */}
          </nav>
        </div>
```

The spine stays presentational — it renders the slot, it does not know what is in it.

- [ ] **Step 2: Carry the mode through `planHref`**

In `page.tsx:221`, add `'edit'` so switching sprint or zoom does not silently drop you out of edit mode:

```ts
    for (const key of ['sprint', 'zoom', 'group', 'q', 'who', 'prio', 'overdue', 'edit']) {
```

- [ ] **Step 3: Parse the mode**

Beside `spineZoom` (line 231), add:

```ts
  const scheduleMode = parseScheduleMode(typeof search.edit === 'string' ? search.edit : undefined)
```

and, beside the `parseZoom` import at line 47:

```ts
import { SCHEDULE_EDIT_PARAM, parseScheduleMode } from '@/features/sprints/schedule-mode'
import { SprintHeader } from '@/features/sprints/components/sprint-header'
```

- [ ] **Step 4: Replace the roadmap branch**

Replace lines 408-545 — from `{tab === 'roadmap' ? (` through its closing `) : null}` — with:

```tsx
      {tab === 'roadmap' ? (
        <div className="flex flex-col gap-4">
          {/* BAND 1 — ONE timeline slot, two modes.
              Read mode is the spine (schedule and sprint selector in one
              object); edit mode swaps the full timeline into this same slot.
              Never both: the previous surface rendered the spine AND an open
              disclosure holding the timeline, which is the duplication the
              unified-roadmap spec §8 forbids in its own words. The mode is a
              URL value, so the rule cannot be violated by a boolean prop. */}
          {sprints.length > 0 ? (
            scheduleMode === 'edit' ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-2xs text-muted-foreground">
                    {isAdmin
                      ? 'Drag to move, edges to resize, click a bar to edit.'
                      : 'Every sprint, with dates.'}
                  </p>
                  <Link
                    href={planHref({ edit: undefined })}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  >
                    Done
                  </Link>
                </div>
                <Roadmap sprints={sprints} slug={slug} counts={sprintTaskCountsById} />
              </div>
            ) : (
              <RoadmapSpine
                sprints={spineSprints}
                selectedId={isBacklog ? null : (selectedSprint?.id ?? null)}
                todayIso={todayIso}
                zoom={spineZoom}
                hrefFor={(sprintId) => planHref({ sprint: sprintId })}
                // 'month' is parseZoom's default, so it is written as the
                // ABSENCE of the param — the canonical link stays clean.
                zoomHrefFor={(level) => planHref({ zoom: level === 'month' ? undefined : level })}
                actions={
                  <>
                    <SprintSwitcher
                      sprints={sprints}
                      selectedId={isBacklog ? '' : (selectedSprint?.id ?? '')}
                    />
                    <Link
                      href={planHref({ edit: SCHEDULE_EDIT_PARAM })}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                    >
                      {isAdmin ? 'Edit schedule' : 'Full schedule'}
                    </Link>
                    {isAdmin ? <SprintFormDialog appId={app.id} /> : null}
                  </>
                }
              />
            )
          ) : null}

          {/* BAND 2 — the sprint's own header, sticky beneath the app header. */}
          {board && (selectedSprint || isBacklog) ? (
            <SprintHeader
              sprint={
                isBacklog || !selectedSprint
                  ? null
                  : {
                      id: selectedSprint.id,
                      name: selectedSprint.name,
                      goal: selectedSprint.goal,
                      startDate: selectedSprint.startDate,
                      endDate: selectedSprint.endDate,
                      status: selectedSprint.status,
                    }
              }
              read={isBacklog ? null : selectedRead}
              gaps={planGaps(boardTasks)}
              checkinGapCount={checkinGapCount}
              backlogCount={boardTasks.length}
              boardHrefFor={(params) => planHref(params)}
              statusSlot={
                isBacklog || !selectedSprint ? null : isAdmin ? (
                  <SprintStatusSelect sprintId={selectedSprint.id} status={selectedSprint.status} />
                ) : (
                  <Badge variant={SPRINT_STATUS_VARIANT[selectedSprint.status]}>
                    {SPRINT_STATUS_LABEL[selectedSprint.status]}
                  </Badge>
                )
              }
              actions={
                isAdmin && !isBacklog && selectedSprint ? (
                  <ExportButton sprintId={selectedSprint.id} />
                ) : null
              }
            />
          ) : null}

          {/* BANDS 3 & 4 — toolbar and columns, both inside Board. */}
          {board && session?.user ? (
            <Board
              initialBoard={board}
              team={team.map((member) => ({ userId: member.userId, name: member.name }))}
              appId={app.id}
              sprintId={boardSprintId}
              currentUser={{ id: session.user.id, role: session.user.role }}
              isBacklog={isBacklog}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <p className="font-heading text-base font-semibold">Nothing to fetch here yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {isAdmin
                  ? 'This app has no sprints. Create the first one and LogPup will keep watch over the board.'
                  : 'No sprints planned for this app yet. LogPup is keeping an eye out — check back soon.'}
              </p>
              {isAdmin ? <SprintFormDialog appId={app.id} /> : null}
            </div>
          )}
        </div>
      ) : null}
```

- [ ] **Step 5: Clean up the orphaned imports**

In `page.tsx`:
- Remove the `LazyDisclosure` import (line 37) and the `PlanReadStrip` import (line 49).
- Keep `SPRINT_STATUS_LABEL` / `SPRINT_STATUS_VARIANT` (lines 61-72) — still used, now through `statusSlot`.
- Keep `planGaps`, `boardHref`, `Badge`, `ExportButton`, `SprintStatusSelect`, `SprintFormDialog`, `SprintSwitcher` — all still called.

Run: `npm run lint`
Expected: clean, or an unused-import error naming exactly what to remove. Remove only what it names.

- [ ] **Step 6: Verify no second timeline can render**

Run: `grep -n "LazyDisclosure\|defaultOpen" "src/app/(app)/apps/[slug]/page.tsx"`
Expected: no matches.

Run: `grep -n "RoadmapSpine\|<Roadmap " "src/app/(app)/apps/[slug]/page.tsx"`
Expected: one usage each, in mutually exclusive branches of the same ternary.

Run: `npx tsc --noEmit`
Expected: errors ONLY about `Board`'s `isBacklog` prop, which Task 5 adds. Note them and continue — do not "fix" them by removing the prop.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/apps/[slug]/page.tsx" src/features/sprints/components/roadmap-spine.tsx
git commit -m "feat: one timeline slot with read and edit modes on the roadmap"
```

---

### Task 5: Toolbar — stat row out, scope line and segmented control in

**Files:**
- Modify: `src/features/sprints/board-view.ts` (add `filteredNotice` beneath `boardSummary`, which starts at line 356)
- Test: `src/features/sprints/board-view.test.ts` (add a `describe` block)
- Modify: `src/features/sprints/components/board-toolbar.tsx` — delete `Stat` (41-69) and the stat row (155-181); add the scope line and segment to the filter row (183-291)
- Modify: `src/features/sprints/components/board.tsx:101-113` and `:444`

**Interfaces:**
- Consumes: `BoardSummary` (`board-view.ts:341`).
- Produces: `filteredNotice(visibleTotal: number, allTotal: number, filtersActive: boolean): string | null`. `BoardToolbar` gains `allTotal: number` and `isBacklog: boolean`. `Board` gains `isBacklog: boolean`, resolving Task 4's outstanding type error.

- [ ] **Step 1: Write the failing test**

Append to `src/features/sprints/board-view.test.ts`, adding `filteredNotice` to the existing import from `./board-view`:

```ts
describe('filteredNotice', () => {
  // Unfiltered, the two numbers agree and the line would be pure noise —
  // which is how a status line teaches people to stop reading it.
  it('says nothing when no filter is active', () => {
    expect(filteredNotice(18, 18, false)).toBeNull()
    expect(filteredNotice(0, 0, false)).toBeNull()
  })

  it('names both scopes when a filter is active', () => {
    expect(filteredNotice(3, 18, true)).toBe('showing 3 of 18')
  })

  // A filter that happens to match everything still leaves a filter chip on
  // screen, so staying silent here would make the chip look broken.
  it('speaks even when the filter excluded nothing', () => {
    expect(filteredNotice(18, 18, true)).toBe('showing 18 of 18')
  })

  it('handles a filter that matched nothing', () => {
    expect(filteredNotice(0, 18, true)).toBe('showing 0 of 18')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- board-view`
Expected: FAIL — `filteredNotice is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/features/sprints/board-view.ts`, beneath `boardSummary`:

```ts
/**
 * "showing 3 of 18", or nothing at all.
 *
 * The board's summary counts the FILTERED list, deliberately (see
 * boardSummary above). The sprint header counts the sprint. Those are two
 * different numbers, and the only honest way to show both is to label the
 * scope of each — so this line names the filtered scope, and only while a
 * filter is on. Unfiltered the two agree, and a line stating an identity is
 * how a reader learns to stop reading the row it sits in.
 */
export function filteredNotice(
  visibleTotal: number,
  allTotal: number,
  filtersActive: boolean,
): string | null {
  if (!filtersActive) return null
  return `showing ${visibleTotal} of ${allTotal}`
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- board-view`
Expected: PASS, including the 4 new assertions.

- [ ] **Step 5: Delete the stat row**

In `board-toolbar.tsx`:
- Delete the `Stat` function entirely (lines 41-69).
- Delete the stat row `<div>` (lines 155-181) — the `done/total` block, its meter, and the four `<Stat>` calls.
- Remove the `StatNumber` import (line 22).
- Run `grep -n "cn(" src/features/sprints/components/board-toolbar.tsx` before removing the `cn` import — the segmented control added in Step 6 uses it, so keep it.
- The outer wrapper collapses: replace `<div className="flex flex-col gap-3">` with the filter row's own `<div className="flex flex-wrap items-center gap-2">` and delete the now-redundant nesting.

- [ ] **Step 6: Add the scope line and the segmented control**

Add to the props type and destructuring: `allTotal: number` and `isBacklog: boolean`.

Above the `return`, beside the existing `const filterCount = activeFilterCount(view.filters)`:

```tsx
  const notice = filteredNotice(summary.total, allTotal, filterCount > 0)

  const pathname = usePathname()
  const searchParams = useSearchParams()
  /** This same board with a different task set, every other param intact. */
  function hrefWithSprint(sprint: string | null): string {
    const params = new URLSearchParams(searchParams.toString())
    if (sprint) params.set('sprint', sprint)
    else params.delete('sprint')
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }
```

Import `filteredNotice` from `@/features/sprints/board-view`, `Link` from `next/link`, and `usePathname` / `useSearchParams` from `next/navigation`.

Inside the filter row, immediately before the existing `Clear` button:

```tsx
        {notice ? (
          <span className="font-mono text-2xs text-muted-foreground tabular-nums">{notice}</span>
        ) : null}
```

and at the end of the same row:

```tsx
        {/* Which task set the board is showing. A sibling of the filters, not
            of "New sprint" — it changes what you are looking at, not the plan.
            Every other param is preserved: switching to the backlog while
            filtered to one person keeps that filter, which the old standalone
            button (built on boardHref, which rebuilds the URL from scratch)
            silently dropped. */}
        <div
          role="group"
          aria-label="Task set"
          className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-0.5"
        >
          <Link
            href={hrefWithSprint(null)}
            aria-current={isBacklog ? undefined : 'true'}
            className={cn(
              'rounded-md px-2 py-1 text-2xs outline-none',
              'transition-colors duration-150 motion-reduce:transition-none',
              'focus-visible:ring-2 focus-visible:ring-ring',
              isBacklog
                ? 'text-muted-foreground hover:text-foreground'
                : 'bg-background font-medium shadow-sm',
            )}
          >
            Sprint
          </Link>
          <Link
            href={hrefWithSprint('backlog')}
            aria-current={isBacklog ? 'true' : undefined}
            className={cn(
              'rounded-md px-2 py-1 text-2xs outline-none',
              'transition-colors duration-150 motion-reduce:transition-none',
              'focus-visible:ring-2 focus-visible:ring-ring',
              isBacklog
                ? 'bg-background font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Backlog
          </Link>
        </div>
```

- [ ] **Step 7: Thread the two new props**

In `board.tsx`:
- Add `isBacklog: boolean` to the props type (107-113) and the destructuring (101-106).
- At line 444:

```tsx
      <BoardToolbar
        view={view}
        summary={summary}
        allTotal={tasks.length}
        isBacklog={isBacklog}
        team={team}
        onChange={setView}
      />
```

`tasks` (line 134) is the full optimistic list; `summary` (line 202) is computed over `visible`, the filtered one. Those are exactly the two scopes the notice names — do not swap them.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit`
Expected: no errors — Task 4's outstanding error is now resolved.

Run: `npm run test`
Expected: all pass.

Run: `grep -n "text-xl" src/features/sprints/components/board-toolbar.tsx`
Expected: no matches.

- [ ] **Step 9: Commit**

```bash
git add src/features/sprints/board-view.ts src/features/sprints/board-view.test.ts src/features/sprints/components/board-toolbar.tsx src/features/sprints/components/board.tsx
git commit -m "feat: replace the board's stat row with a scoped filter notice"
```

---

### Task 6: One empty state, and full verification

**Files:**
- Modify: `src/features/sprints/components/board.tsx:446-453` (delete the duplicate banner) and `:487` (pass the variant)
- Modify: `src/features/sprints/components/board-column.tsx:96-104` (the variant) plus its props type
- Decide: `src/components/shared/lazy-disclosure.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BoardColumn` gains `emptyVariant: 'invite' | 'quiet'`.

- [ ] **Step 1: Delete the duplicate banner**

In `board.tsx`, delete lines 446-453 — the `tasks.length === 0` block. Its headline is byte-identical to the page's own no-sprints banner, and it renders directly above three columns that each say the same thing again.

Run: `grep -rn "Nothing to fetch here yet" src`
Expected: exactly one match, in `page.tsx`.

- [ ] **Step 2: Add the column variant**

In `board-column.tsx`, add `emptyVariant: 'invite' | 'quiet'` to the props type and destructuring, then replace lines 96-104 with:

```tsx
          {group.tasks.length === 0 ? (
            /* Three emptinesses, three different next steps. A FILTERED column
               tells you the work exists and is hidden, and has to say so
               wherever the gap is. An unfiltered empty board needs the
               invitation exactly ONCE — three boxed sentences saying "add one
               below" is one instruction shouted three times. The rest get a
               hairline: still visibly a drop target, silent about it. */
            filtersActive ? (
              <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
                Nothing here matches the current filters.
              </p>
            ) : emptyVariant === 'invite' ? (
              <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
                Nothing here yet — add one below, or drag one over.
              </p>
            ) : (
              <div
                aria-hidden
                className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/50 px-2 py-6"
              />
            )
          ) : (
```

`aria-hidden` on the quiet variant is deliberate: it carries no information a screen reader needs, the column's own count already announces `0`, and reading out an empty decorative box three times is noise.

- [ ] **Step 3: Pass the variant**

In `board.tsx`, give the map an index and pass it:

```tsx
          {groups.map((group, index) => (
            <BoardColumn
              key={group.id}
              group={group}
              emptyVariant={index === 0 ? 'invite' : 'quiet'}
              share={summary.total === 0 ? 0 : group.tasks.length / summary.total}
```

The column is told which variant to render; it does not infer "am I first" from an index it should not know about.

- [ ] **Step 4: Settle `lazy-disclosure.tsx`**

Run: `grep -rn "LazyDisclosure" src`
Expected: only the component's own file.

Then check the sibling worktrees before removing anything:

```bash
grep -rn "LazyDisclosure" ../LogPup-sdd-*/src 2>/dev/null || echo "no sibling worktree uses it"
```

If nothing anywhere uses it, delete the file and commit the deletion — an unreferenced shared component is dead code, and this repo's no-hard-delete rule governs user data, not source. If a sibling worktree does use it, leave it in place and say so in the final report.

- [ ] **Step 5: Full verification**

Run each and read the output before claiming anything passes:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

Expected: all four clean.

- [ ] **Step 6: Manual pass — every state in spec §8**

Start the app (`npm run dev`) and check:

1. **App with no sprints** — bands 1 and 2 absent; the page's own empty state alone on screen.
2. **Sprint with no tasks** — four bands; exactly ONE "add one below" invitation, in the first column; no banner above the columns.
3. **Sprint with tasks** — measure the distance to the first card on a 1080p window. The spec's budget is ~250px, from ~840px before. Report the number you measure, not the number the spec predicted.
4. **Filter to one person** — band 2 still shows the sprint's full `11/18`; the toolbar shows `showing 3 of 18`. Each correct for its own scope.
5. **Backlog** — band 2 is the one-line backlog header, no dates and no meter; the segment shows Backlog current.
6. **Filter, then switch to Backlog** — the filter survives the switch. This is the `boardHref` bug the segment fixes.
7. **Edit schedule** — the spine is REPLACED by the full timeline, not joined by it. Exactly one zoom control on screen. Drag a bar, click Done, confirm the spine shows the new dates.
8. **Scroll the board** — band 2 pins under the app header, stays opaque, and nothing shows through at its sides. Also confirm the `PlanReadStrip` row flattened (Task 3 step 3) rather than rendering as a card inside a card.

- [ ] **Step 7: Manual pass — keyboard**

Tab from the spine through to a task card without a mouse:

spine bar → All sprints → Edit schedule → (in edit mode) Done → search → Group → Filter → Overdue → Sprint|Backlog → column composer → card.

Every stop must show a visible focus ring. The segment must announce its current item (`aria-current`). Confirm the sticky band 2 does not cover a focused element when tabbing into the board — if it does, add `scroll-mt-28` to the column sections in `board-column.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/features/sprints/components/board.tsx src/features/sprints/components/board-column.tsx
git commit -m "feat: one empty-state invitation per board"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §4 one timeline slot, two modes | 1, 4 |
| §4 `defaultOpen` / disclosure removed | 4 steps 4-6 |
| §4 zoom control renders once | 4 step 4 — mutually exclusive branches |
| §4 New sprint + All sprints into band 1 header | 4 steps 1, 4 |
| §5 sprint header, sticky `top-14` `z-10` | 3 |
| §5 numbers `text-sm`/`text-xs` mono, never `text-xl` | 3; 5 step 8 asserts it |
| §5 chips reuse `PlanReadStrip` | 3 step 1 |
| §5 backlog collapses to one line | 3 step 1 |
| §6 stat row deleted | 5 step 5 |
| §6 Sprint\|Backlog segment, params preserved | 5 step 6 |
| §6 "showing N of M", filtered only | 5 steps 1-4, 6 |
| §7 duplicate banner deleted | 6 step 1 |
| §7 one invitation, explicit prop | 6 steps 2-3 |
| §7 filtered-empty copy unchanged | 6 step 2 |
| §8 every state | 6 step 6 |
| §10 `lazy-disclosure` disposition | 6 step 4 |

No gaps.

**Type consistency:** `SprintRead`, `PlanGaps` are spelled as `plan-read.ts` exports them. `remainingLabelShort` takes a `number` in Task 2 and is called with `read.progress.remainingDays` in Tasks 2 and 3. `filteredNotice(visibleTotal, allTotal, filtersActive)` is defined in Task 5 step 3 and called as `filteredNotice(summary.total, allTotal, filterCount > 0)` in step 6, with the two scopes spelled out in step 7. `emptyVariant: 'invite' | 'quiet'` is identical in Task 6 steps 2 and 3. `isBacklog` is introduced in Task 4 step 4 (call site) and typed in Task 5 step 7 (signature) — the gap between them is called out in both places.

**Known soft spots, flagged rather than hidden:**

- Task 3 step 3 assumes `cn()` lets a passed `className` override `PlanReadStrip`'s own padding and ring. That is `tailwind-merge` behaviour and this repo uses it, but the step verifies rather than trusts, and names the fallback.
- Task 3's `-mx-6` assumes the roadmap branch's nearest ancestor is the page's `p-6` container with no `overflow-hidden` between. Task 6 step 6 case 8 is the check.
- The ~250px vertical budget is an estimate. Task 6 step 6 case 3 measures it and reports the real number.
