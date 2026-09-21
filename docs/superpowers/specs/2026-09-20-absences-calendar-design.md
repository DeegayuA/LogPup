# The Absence Month — /admin/absences calendar redesign

2026-09-20. Applies to `/admin/absences` only. The page's capability gate, the absence actions, `absence-queries.ts` and `absence-kinds.ts` are untouched.

**Subject + audience + job.** LogPup's admin absence surface for a bilingual (Sinhala/English) EPC studio. Today it answers "what was filed last" — 50 rows, newest first, no date structure. The question an admin actually opens it with is **"who is out, when"**: is Friday covered, does this week have three people away, is that leave next to a mercantile holiday. A flat list cannot answer a shape question. The new job: see the month's absence shape in one glance, then decide any day's filings without leaving the page.

**Thesis.** The page becomes a **Monday-started month grid** whose cells carry *identity* (who) through the existing `--event-1..8` ramp and *kind* through a small four-icon group marker — never a second colour hash. Holidays and non-working days are drawn from `lk-holidays.ts` + `org_holidays` + `working-days.ts`, the one definition each. Selecting a day opens a right-side sheet listing that day's filings, pending first, with approve/reject calling the **existing** `approveAbsence`/`rejectAbsence` through the **existing** `ApprovalActions`. The old list survives verbatim at `?view=list`. **No schema migrations, no new server actions, no new permission predicate.**

## Palette / type / signature

No new tokens, no new hues. Watchdog calm (`docs/superpowers/specs/2026-08-11-ui-redesign-design.md`): identity exclusively through `event-color.ts` (`eventSolidClasses` / `eventColorClasses`, both already-written literal `Record<number,string>` — **nothing interpolates `bg-event-${n}`**), holiday tint through `--holiday` / `--mercantile` via `holidayToneClass`, ember `--chart-1` untouched (it means capacity/attention elsewhere and a calendar full of it would mean nothing). Every date, day number and count `font-mono tabular-nums`. Hairline `border` for the grid's structure; the day sheet is this page's only shadow and only floating layer.

**Signature element: the month grid itself** — seven columns, `border-border/60` hairline cells, the date number top-left in mono, identity chips stacked below, holiday name and group icon bottom-aligned. Today's number carries the primary underline the worklog calendar already uses, so the two calendars in this app read as one family.

**Avoided defaults:** a second colour scale keyed to absence kind (14 kinds, 8 slots, and colour would then carry meaning that text already carries); status-by-colour-alone; gradient day fills; hover-revealed approve buttons; a spinner where the grid's shape is already known.

## Zones

1. **Card header** (unchanged `CardTitle as="h2"` + description — the admin layout owns the single h1).
2. **Toolbar**, server-rendered from the URL alone, **outside** the Suspense boundary so it is on screen and clickable while the month query runs (the pattern `people/history/page.tsx` established; this page today awaits everything inline and paints nothing until the DB answers): `‹ Prev` · month label · `Next ›` · **Today** · view toggle (Calendar / List) · kind filter (a `<select>`-free popover is not needed — a row of group-labelled links, or the existing `Select`, both acceptable; whichever, it is a `<Link>`-driven URL write, no client state).
3. **The grid** (inside `<Suspense>`), 5 or 6 Monday-started weeks covering the focused month, padded days from the neighbouring months rendered dimmed but real — an absence on the 31st of last month IS visible in the cell the user can see.
4. **Day sheet** (overlay, mounted only while `?day=` is set).
5. **Legend**, one line under the grid: Pending (dashed) · Approved (solid) · Holiday · Non-working day. Four entries, not fourteen.

## Day cell anatomy

Fixed minimum height so the grid never reflows between months (`min-h-[92px]`, `min-h-[64px]` below `sm`).

1. **Date number**, mono tabular-nums, top-left. Today: `font-bold underline decoration-2 underline-offset-2 text-primary` (worklog-calendar precedent). Padded neighbour-month days: `text-muted-foreground/60`.
2. **Quiet days.** `isWorkingDay(iso, isHolidayWithOrg)` is the ONE test — Sundays, mercantile holidays and org holidays get `bg-muted/40` and nothing else; Saturdays (`isHalfWorkingDay`) get a `½` mono marker top-right. The `isHoliday` callback is composed from `isMercantileHoliday` ∪ the month's `org_holidays` days exactly as `coverage.ts` composes it — a second definition here is the bug `getOrgHolidayDays`' own comment is about.
3. **Holiday name**, bottom, truncated, with `HolidayIcons` + `holidayToneClass` + `holidayCategoryLabel` (already shared by the day strip and the meetings month grid). An org holiday with no gazette entry renders its own name with the mercantile tone and the `Store` glyph — it closes the studio, that is what that tone means.
4. **Identity chips**, max 3 visible + `+N more`:
   - **approved** → `eventSolidClasses(userId)` (saturated, `text-background` — the token that inverts correctly in both themes).
   - **pending** → `eventColorClasses(userId)` + `border-dashed`. Not yet a fact, so it is not yet solid. State reads before identity at a glance, and the word "Pending" is in the cell's accessible name regardless.
   - Chip text: the person's **first name** (`userName.split(' ')[0]`, `bilingualText` so a Sinhala name is never cut by JS), plus a superscript `½` when `!exemptsWholeDay(kind)`.
   - **Kind marker**: one lucide glyph per `AbsenceGroup` — `Plane` (Time off), `Clock` (Part of a day), `Briefcase` (Working, elsewhere), `FileText` (Filed for you). Four groups, four glyphs, `aria-hidden`; the full `absenceKindLabel(kind)` is in the accessible name and printed in the sheet. Kind never gets a hue.
   - Chips are **not individually focusable** — see a11y below.
5. **Rejected and withdrawn rows never enter the grid.** A calendar answers "who is out"; a refused filing is not somebody being out, and painting it makes the month lie. They are in the day sheet (all four statuses) and in `?view=list` (unchanged, all statuses). Recorded as a deliberate difference between grid and sheet.

Below `sm`, chips collapse to identity dots (`size-2` rounded, same solid/dashed treatment) plus a mono count; the names are read in the sheet. **No week-strip variant and no horizontal scroll** — a week strip is a second view with its own date math, nav unit, empty state and URL grammar, for a page whose whole job is the month's shape. Seven columns at 320px is ~40px a cell, which the worklog calendar already ships.

## Day sheet

`?day=YYYY-MM-DD` mounts a right-side `Dialog` (the `meeting-intel-sheet.tsx` pattern: `role=dialog`, `min(560px, 92vw)`, full-screen below `lg`, 200ms transform+opacity, fade-only under reduced motion). Header: the full date, its holiday/non-working status in words, and the count. Body: that day's filings, **pending first**, then by start date, then by name. Each row: name, `absenceKindLabel`, the part-day badge and its "still owes a log" wording (kept verbatim from today's page — the vocabulary reason in that comment is still true), the full range in mono, the status word, the reason in `bilingualText`, and `<ApprovalActions id={a.id} kind="absence" isSelf={...} />` rendered only when the server said `canReview`. Closing (Esc / X / backdrop) writes the URL back to the month and returns focus to the originating cell.

`ApprovalActions` already revalidates through `revalidatePath('/admin','layout')` inside `review()` — the grid and sheet repaint themselves with no new wiring.

## URL grammar

`?view=calendar|list&month=YYYY-MM&day=YYYY-MM-DD&kind=<AbsenceKind>` — every control a plain `<Link scroll={false}>`, every value re-derived on the server at render. Calendar is the default (no `?view=`). `?day` must name a day **on the current grid**; anything else is ignored rather than opening an empty sheet. `?kind` filters grid, sheet and list alike. Today is `toIsoDateInTimeZone(new Date())` — **never** `toISOString().slice(0,10)`, which is the day before for half of Colombo's evening.

## States

- **Loading**: toolbar and card header paint from the URL immediately; the grid area shows `AbsenceCalendarSkeleton` — the same 7×6 cell geometry at the same `min-h`, `Skeleton` blocks where chips go. Pulse, never a spinner.
- **Empty month**: the grid still renders (a month with nobody away is the answer, not an absence of one); under it, one line — "Nobody is away in September 2026." + a link to `?view=list`.
- **Error**: the data component catches and renders an inline notice (icon + words + a "Try again" link to the same URL) in the grid's place; the toolbar stays usable so the user can step to another month. The admin `error.tsx` boundary stays the backstop for anything thrown outside it.
- **Filtered-empty**: distinct copy naming the kind + a Clear link.

## A11y

The grid is a **true ARIA grid with roving tabindex** — new to this codebase (the meetings month grid has no grid semantics; its keyboard story is dnd-kit's). `role="grid"` with an `aria-label` naming the month; a weekday header row of `role="columnheader"`; one `role="row"` per week (`display: contents` so the CSS grid still lays the cells out); `role="gridcell"` per day containing one focusable button.

- Exactly **one tab stop** for the whole grid. `tabIndex=0` on the focused day (selected day → today → 1st of month), `-1` on the rest.
- Arrows ±1 / ±7, Home/End = start/end of week, PageUp/PageDown = previous/next month (navigates the URL), Enter/Space opens the day sheet.
- `aria-selected` on the cell matching `?day`; `aria-current="date"` on today, whose accessible name also ends "today".
- The cell button's accessible name is the whole fact: `"Friday 18 September, 2 away: Nimal — Annual leave, approved; Kasun — Half day, pending. Mercantile holiday: Binara Full Moon Poya Day."` Colour is never the only signal — status is a word, kind is a word, the holiday is a word.
- **Why chips are not focusable**: a grid whose cells contain their own tab stops stops being arrow-navigable and becomes 90 tab stops a month. The detail and every action live one Enter away in the sheet, which is focus-trapped and has real buttons.
- Toolbar buttons at a boundary use `aria-disabled` + `pointer-events-none`, never `disabled` — the documented reason in `meetings-calendar.tsx` (a focused button must not drop out of the focusable set mid-interaction).

## Capability

Page gate unchanged: `loadActor()` + `can(actor, 'absence.view')` → `notFound()`. **The inline `can(actor,'absence.approve',{appId:null}) || can(actor,'absence.approve')` at today's page lines 21-22 is deleted.** That is the scoped-grant-fails-closed shape `absence-queries.ts`' own comments (L28-43, L81-103) record fixing once already: it hands every manager a page-wide yes/no instead of asking per row against the *absent person's* apps. Review reach is decided **per row, in the query**, with the exported `canReviewAbsence` — and self-rows follow `listPendingAbsences`' rule exactly (`request.review.self` decides, `ApprovalActions` already has the `isSelf` prop and the "Approve your own" label). **No second predicate is written.**

## Data contracts (pin these — implementers build to them)

All reads actor-scoped. **No schema migrations. No new server actions.**

```ts
// NEW src/features/worklog/absence-calendar-queries.ts
import type { AbsenceRow } from '@/features/worklog/absence-queries'

/** An absence plus the ONE answer the UI may not re-derive: may this actor decide it. */
export type AbsenceCalendarRow = AbsenceRow & { canReview: boolean }

/**
 * Every absence of every status overlapping [fromIso, toIso], BOTH BOUNDS
 * INCLUSIVE — `startDate <= to AND endDate >= from`, the overlap predicate
 * `approvedAbsenceUserIds` documents. Containment would drop a fortnight's
 * leave that spans the whole grid, which is exactly the row that matters.
 * Same view gate as listRecentAbsences. canReview per row:
 *   row.userId === actor.id ? can(actor,'request.review.self',{ownerId:actor.id})
 *                           : canReviewAbsence(actor, { userId, appIds })
 * appIds are the ABSENT PERSON's assignments, batched in ONE inArray read and
 * paid only when `can(actor,'absence.approve')` is false (the 'scoped' case) —
 * short-circuit copied from listPendingAbsences.
 */
export async function listAbsencesForRange(
  actor: Actor, fromIso: string, toIso: string,
): Promise<AbsenceCalendarRow[]>

/** The month's two reads in one round trip. orgHolidayDays is getOrgHolidayDays
 *  (worklog/queries.ts) — revocation already applied there; never re-read the table. */
export async function loadAbsenceCalendar(
  actor: Actor, fromIso: string, toIso: string,
): Promise<{ rows: AbsenceCalendarRow[]; orgHolidayDays: string[] }>
```

```ts
// NEW src/features/worklog/absence-calendar.ts — PURE. No @/db import, no React.
// Generic over the row shape so the test needs no query module and no Actor.
export type AbsenceSpan = {
  id: string; userId: string; userName: string
  kind: string; status: string; startDate: string; endDate: string
}

export function parseAbsenceMonth(raw: string | null | undefined, todayIso: string): string // 'yyyy-mm'
export function shiftAbsenceMonth(month: string, steps: number): string   // addCalendarMonths
export function absenceMonthGrid(month: string): { days: string[]; from: string; to: string }
//   visibleRange('month', `${month}-01`) verbatim — 28/35/42 Monday-started days.
//   `to` is the LAST grid day (inclusive); the query gets [from, to].
export function parseAbsenceDay(raw: string | null | undefined, days: readonly string[]): string | null
export function parseAbsenceKind(raw: string | null | undefined): AbsenceKind | null

/** Pending + approved only — see "Rejected and withdrawn never enter the grid". */
export const GRID_STATUSES: readonly string[]

/**
 * day -> rows, for the grid. Fans each row out with `absenceDays(...)`, which is
 * HALF-OPEN at its `to`: call it with isoDayAdd(lastGridDay, 1) or the last
 * column silently loses every absence ending on it. That clip is here, once.
 */
export function groupAbsencesByDay<T extends AbsenceSpan>(
  rows: readonly T[], days: readonly string[],
): Map<string, T[]>

/** All four statuses, for the sheet. Pending first, then startDate, then name. */
export function dayAbsences<T extends AbsenceSpan>(rows: readonly T[], day: string): T[]

/** The composed studio predicate the whole page shares: gazette ∪ org holidays. */
export function makeIsHoliday(orgHolidayDays: readonly string[]): (iso: string) => boolean
```

Reused unchanged, not reimplemented: `visibleRange` / `addCalendarMonths` / `isIsoDate` (`meetings/calendar-view.ts` — pure yyyy-mm-dd UTC arithmetic, zero meeting logic), `absenceDays` (`worklog/absence-days.ts`), `isoDayAdd` (`people/iso-day.ts`), `isWorkingDay` / `isHalfWorkingDay` (`lib/working-days.ts`), `isMercantileHoliday` / `getLkHoliday` / `toIsoDateInTimeZone` (`lib/lk-holidays.ts`), `getOrgHolidayDays` (`worklog/queries.ts`), `HolidayIcons` / `holidayToneClass` / `holidayCategoryLabel` (`components/shared/holiday-icon.tsx`), `eventSolidClasses` / `eventColorClasses` (`meetings/event-color.ts`), `absenceKindLabel` / `exemptsWholeDay` / `ABSENCE_KIND_DEFINITIONS` (`worklog/absence-kinds.ts`), `canReviewAbsence` (`worklog/absence-queries.ts`), `ApprovalActions`, `bilingualText`, `Skeleton`, `EmptyState`.

**Why one new grid component and not `MeetingsMonthCalendar`**: its props are meeting-shaped (`upcoming`/`past`/`users`/`apps`/`onOpenMeetingInList`), it is 733 lines of dnd-kit drag-to-reschedule around a data model with instants and durations, and absences are all-day multi-day spans with a review decision. Reuse is taken at the layer that is actually generic — its date math (`calendar-view.ts`) and its holiday rendering — which is most of what the grid is. `WorklogCalendar` is likewise per-person day-state, one fact per cell; the new grid carries N people per cell.

**Tests required** (all on the pure module — this repo has zero `.test.tsx`, component logic that needs a test belongs in `absence-calendar.ts`): last-column inclusivity (an absence ending on the final grid day appears there); a span covering the whole grid appears in every cell; rejected/withdrawn excluded from `groupAbsencesByDay` and included in `dayAbsences`; pending sorts first; `parseAbsenceMonth` rejects `2026-13` and hand-mangled input; `parseAbsenceDay` rejects an off-grid day; `makeIsHoliday` returns true for an org holiday the gazette does not know and false for a bank-only day (mercantile-only excuses work). Query test: the overlap predicate, the view gate returning `[]`, and `canReview` false for a manager who does not run the absent person's apps (the scoped-fails-closed regression).

## Registry

No change to `src/features/search/registry/registry.test.ts`. `?view=calendar` is the same destination `/admin/absences`, not a new one, and admin's existing `NO_COMMANDS` reason ("every action needs a target row") still holds — approve/reject need a row, and month navigation needs a month. `worklog/commands.ts` (the "declare absence" action) is untouched.

## Deferred (recorded, not forgotten)

Drag-to-reschedule an absence; bulk approve a day or a selection; iCal / Google Calendar export of the absence month; per-person year view ("how much leave has Nimal taken"); week and day views; filing an absence from a grid cell; a coverage overlay (N of M people out, shading a day red past a threshold); filtering by person or by app; inline org-holiday editing from the grid (it lives at `/admin/holidays`); pagination of the list view beyond its existing 50.
