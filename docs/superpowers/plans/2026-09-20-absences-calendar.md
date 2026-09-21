# Plan — /admin/absences calendar redesign

Spec: `docs/superpowers/specs/2026-09-20-absences-calendar-design.md`. 2026-09-20.

Three disjoint owners. **Task 1 lands before 2 and 3 start** (both import its types). Tasks 2 and 3 are parallel on disjoint files.

**Never edit** (parallel sessions own them, or they are load-bearing): `src/features/worklog/absence-queries.ts`, `absence-actions.ts`, `absence-kinds.ts`, `absence-days.ts`, `src/features/meetings/**`, `src/features/auth/capabilities.ts`, `src/features/admin/change-request-*`, `src/features/apps/signoff.ts`, `src/app/(app)/people/[id]/page.tsx`, `src/features/finance/**`, `src/components/ui/**`, `src/features/search/registry/**`.

---

## Owner: queries

### - [ ] 1a. Pure calendar module
Write `src/features/worklog/absence-calendar.test.ts` first, then `src/features/worklog/absence-calendar.ts`.

Files: `src/features/worklog/absence-calendar.ts` (new), `src/features/worklog/absence-calendar.test.ts` (new).

Exports exactly as the spec's Data contracts block: `AbsenceSpan`, `parseAbsenceMonth`, `shiftAbsenceMonth`, `absenceMonthGrid`, `parseAbsenceDay`, `parseAbsenceKind`, `GRID_STATUSES`, `groupAbsencesByDay`, `dayAbsences`, `makeIsHoliday`.

Binding details:
- `absenceMonthGrid` wraps `visibleRange('month', \`${month}-01\`)` from `@/features/meetings/calendar-view`; `shiftAbsenceMonth` wraps `addCalendarMonths`. Do not re-derive month arithmetic.
- `groupAbsencesByDay` calls `absenceDays(rows, from, isoDayAdd(to, 1))` — **half-open at `to`**; a comment must say why, or the last column loses rows.
- Pure: no `@/db`, no React, no `Actor`. Type-only imports are fine.
- Comments say WHY (the half-open clip, why rejected/withdrawn are out of `GRID_STATUSES`, why the holiday predicate is composed once).

Tests: every case listed under "Tests required" in the spec that does not need a DB.

Verify: `S=<scratchpad>; mkdir -p "$S"; npx vitest run src/features/worklog/absence-calendar.test.ts > "$S/v1a.txt" 2>&1; echo "exit: $?"; tail -n 20 "$S/v1a.txt"`

### - [ ] 1b. Calendar query module
Files: `src/features/worklog/absence-calendar-queries.ts` (new), `src/features/worklog/absence-calendar-queries.test.ts` (new).

`listAbsencesForRange(actor, fromIso, toIso)` and `loadAbsenceCalendar(actor, fromIso, toIso)` per the spec.
- Re-declare the `select` object locally (it is not exported from `absence-queries.ts`, which you must not edit); import the `AbsenceRow` type and `canReviewAbsence` from it.
- Overlap: `and(lte(absences.startDate, toIso), gte(absences.endDate, fromIso))`, both bounds inclusive, with the comment saying containment would drop a span covering the whole grid.
- View gate identical to `listRecentAbsences`.
- `canReview`: self row → `can(actor, 'request.review.self', { ownerId: actor.id })`; otherwise `canReviewAbsence(actor, { userId, appIds })`. **Do not write a second predicate.** Skip the assignments read entirely when `effectiveGrant(...) === 'none'` (return `[]`) or when `can(actor,'absence.approve')` is true.
- `loadAbsenceCalendar` = `Promise.all([listAbsencesForRange(...), getOrgHolidayDays(fromIso, toIso)])`.

Tests: mock `@/db` the way `src/features/worklog/absence-queries.test.ts` and `queries.test.ts` already do; cover the overlap predicate shape, the view gate returning `[]`, `canReview` false for a manager outside the absent person's apps, `canReview` true for an admin, and the self-row path.

Verify: `S=<scratchpad>; mkdir -p "$S"; npx vitest run src/features/worklog/absence-calendar-queries.test.ts > "$S/v1b.txt" 2>&1; echo "exit: $?"; tail -n 20 "$S/v1b.txt"`

---

## Owner: components

Starts after 1a/1b land. Every file below is new; touch nothing else.

### - [ ] 2a. Toolbar + skeleton (server components, no client JS)
Files: `src/features/worklog/components/absence-calendar-toolbar.tsx` (new), `src/features/worklog/components/absence-calendar-skeleton.tsx` (new).

Toolbar: Prev / month label / Next / Today / view toggle (Calendar·List) / kind filter — all `<Link scroll={false}>` writing `?view`, `?month`, `?kind`, preserving the other params. Boundary buttons use `aria-disabled` + `pointer-events-none`, never `disabled`. `aria-current` on the active view and kind. Month label + counts `font-mono tabular-nums`.

Skeleton: 7 columns × 6 rows of `Skeleton` at the real cell `min-h` (`min-h-[92px]`, `min-h-[64px]` below `sm`), plus the weekday header row. `aria-hidden` (Skeleton already is).

Verify: `npx tsc --noEmit -p tsconfig.json` exit 0 + `npx eslint --ignore-pattern '.claude/' --ignore-pattern '.next-e2e/' src/features/worklog/components/` exit 0.

### - [ ] 2b. Month grid
File: `src/features/worklog/components/absence-month-grid.tsx` (new, `'use client'` — the roving tabindex is the only reason it is a client component; it fetches nothing).

Props: `{ month, days, todayIso, selectedDay, byDay, isHolidayDays, monthHref(day: string|null): string }` — all serializable, no `Actor`, no functions from the server except the href builder computed as a plain string map or a base href the component appends to (prefer a `baseHref` string + param names so no function crosses the boundary).

Build per spec: `role="grid"` + columnheader row + `role="row"` week wrappers with `display: contents` + one focusable button per `role="gridcell"`; roving tabindex; Arrows / Home / End / PageUp / PageDown / Enter / Space; `aria-selected`; `aria-current="date"`; the full-sentence accessible name; chips via `eventSolidClasses` (approved) and `eventColorClasses` + `border-dashed` (pending); the four group glyphs `Plane` / `Clock` / `Briefcase` / `FileText`, `aria-hidden`; `½` for `!exemptsWholeDay`; max 3 chips + `+N more`; holiday name + `HolidayIcons` + `holidayToneClass`; quiet days via `isWorkingDay(iso, isHoliday)`; below `sm` chips become dots + a count. Named transitions only (`transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none`), no `transition-all`, no gradients, tokens only.

Any non-trivial derivation (which chips are visible, the accessible sentence) goes in `absence-calendar.ts`'s owner's module only if it is pure and already specified — otherwise keep it local and simple; do **not** add exports to `absence-calendar.ts` (different owner).

Verify: tsc exit 0 + eslint exit 0 + `npx vitest run src/features/worklog/` exit 0.

### - [ ] 2c. Day sheet + list view
Files: `src/features/worklog/components/absence-day-panel.tsx` (new, `'use client'`), `src/features/worklog/components/absence-list-view.tsx` (new, server).

Day panel: `Dialog` right-side sheet per `meeting-intel-sheet.tsx`; `open` derived from the `day` prop; close writes the month URL back (`router.replace(monthHref, { scroll: false })`) and returns focus to the originating cell. Rows: name, `absenceKindLabel`, the part-day badge **with today's exact "part day — still owes a log" wording**, mono range, status word, reason in `bilingualText`, and `<ApprovalActions id kind="absence" isSelf={row.userId === actorId} />` only when `row.canReview`. Pending first.

List view: today's `<ul>` from `page.tsx` lines 43-80 lifted out **unchanged in substance**, including the `absenceKindLabel` comment (lines 50-55) — it explains why the label and not the enum, and it is still true. Reads `canReview` from the row now, not from a page-level boolean.

Verify: tsc exit 0 + eslint exit 0.

---

## Owner: page

### - [ ] 3. Rewrite the route
File: `src/app/(app)/admin/absences/page.tsx` (edit — the only file this owner touches).

- Keep `loadActor()` + `can(actor,'absence.view')` → `notFound()`.
- **Delete** the page-level `canReview` (lines 21-22) and its comment; review reach now arrives per row.
- Parse `searchParams` (a `Promise` in Next 16): `view`, `month`, `day`, `kind`. `todayIso = toIsoDateInTimeZone(new Date())` — never `toISOString().slice(0,10)`.
- Render card header + `<AbsenceCalendarToolbar>` synchronously; wrap the data in `<Suspense fallback={<AbsenceCalendarSkeleton />}>` around an inner `async` component that calls `loadAbsenceCalendar` (the people/history split).
- Calendar path: `absenceMonthGrid` → `loadAbsenceCalendar(actor, from, to)` → `groupAbsencesByDay` (filtered to `GRID_STATUSES` and `?kind`) → `<AbsenceMonthGrid>` + `<AbsenceDayPanel>` when `?day` resolves.
- List path (`?view=list`): `listRecentAbsences` as today, rendered through `<AbsenceListView>`; keep the Card description wording.
- Inline error: the inner component try/catches its load and renders the designed notice; empty-month and filtered-empty copy per spec.
- Header comment says WHY the page is split this way (controls before data) and why grid ≠ sheet on statuses.

Verify: tsc exit 0; `npx vitest run` exit 0; `npm run build` exit 0 (route under `src/app/`); browser rung on port 3400 (`/admin/absences`, `?day=`, `?view=list`) with `take_snapshot` + `take_screenshot` + zero console errors + no 4xx/5xx.

---

## - [ ] 4. Review
Per CLAUDE.md §6, one parallel batch: `ecc:typescript-reviewer` + `ecc:silent-failure-hunter` + `ecc:code-reviewer` + `ecc:react-reviewer` + `ecc:a11y-architect` (the ARIA grid is new to this codebase — it is the reviewer's first target) + `ecc:database-reviewer` (new query module). Then `craft` and the `designing-ui` WCAG lens against the pre-redesign diff.

## - [ ] 5. Record
Tick this plan; `README.md` Features if the calendar is user-visible enough to list; `graphify update .`; memory entry only if a new trap appears (the `absenceDays` half-open clip is a candidate).
