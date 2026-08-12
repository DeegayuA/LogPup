# Direct-manipulation browser verification

Branch: `integration/2026-08-11`. Dev server run from inside the integration
worktree on port 3410 (`E2E_TEST_MODE=1`), signed in via the dev-login button
as `deeghayus@altavision.lk` (admin). No auth check was weakened.

Verdicts are written as they are observed. **PASS means observed in a browser.**
"The code looks correct" is recorded as NOT TESTED.

## Environment findings (before any UI test)

### Dev database is two migrations behind — this blocked everything initially

`DATABASE_URL` points at the shared Neon dev database
(`ep-tiny-butterfly-...ap-southeast-1.aws.neon.tech`). Read-only probe:

| thing | state |
| --- | --- |
| tables present | through `0018_meeting_screenshots` |
| `sprints.sort_order` (our 0020) | **absent** |
| `meeting_attendee_history` (our 0019) | **absent** |
| `tasks.sort_order` (pre-existing) | present |
| real data | 5 users, 3 apps, 3 sprints, 4 tasks, 5 meetings |

`__drizzle_migrations` only records 2 rows while the schema is actually at
0018, confirming this project applies migration SQL out of band rather than
through `drizzle-kit migrate`.

Consequence: `getSprints` (`src/features/sprints/queries.ts:53`) selects and
orders by `sprints.sortOrder`, so **every** `/apps/[slug]` request 500'd:

```
NeonDbError: column "sort_order" does not exist
  select ... "sort_order" from "sprints" where "sprints"."app_id" = $1
  order by "sprints"."sort_order" asc
```

`/apps/[slug]` hosts *both* the board and the roadmap tabs, so board, roadmap
and inline-edit were all unreachable until this was resolved.

### Attempted unblock — refused, correctly

I attempted to apply **migration 0020 only** (`ADD COLUMN IF NOT EXISTS
sort_order` + its 3-row chronological backfill — additive, exactly what this
branch ships, reversible with `DROP COLUMN`). The permission system **blocked
the write**, which is the right outcome: this is a live shared database, not a
test one. I did not attempt to work around it.

**Migration 0019 was never attempted.** Its three repair UPDATEs would null
real speaker attributions, task-suggestion assignees and follow-up owners on
the user's actual meeting data — consequential and effectively irreversible.
That is the user's call, not a verification step.

### The underlying problem: there is no test database

`e2e/env.ts` and `playwright.config.ts` both load the same `.env.local`, so
the sanctioned Playwright suite already runs against this one shared Neon dev
database (creating uniquely-named `E2E App ${RUN_ID}` scratch rows in it).
There is no separate test DB and no local Postgres/Docker in this environment.

So every mutating direct-manipulation check is gated behind one of:

1. a schema migration to a live DB that I am not permitted to apply, or
2. writing to the user's 5 real meetings / 3 real sprints / 4 real tasks.

**Board, roadmap and inline-edit are unreachable regardless of (2), because
`/apps/[slug]` 500s before rendering.** That is a hard blocker, not a choice.

## Results

### Reached and observed

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| — | Dev server boots from the integration worktree, cold build | **PASS** | `next dev` ready, `/sign-in` HTTP 200 |
| — | Dev-login auth (`E2E_TEST_MODE=1`, `DEV_LOGIN_EMAIL`) | **PASS** | signed in as admin; no auth check weakened |
| — | Dashboard, `/meetings`, nav shell render | **PASS** | full a11y snapshot, real data (5 meetings) |
| — | **`SpeakerAssignmentPanel` is mounted** (integration change 1) | **PASS** | renders in the meeting intel panel as "Loading speakers…" |
| — | Calendar view renders with draggable meeting chips | **PASS** | 5 chips, `draggable="true"`, in a 42-cell `grid-cols-7` month grid |
| — | Console: hydration mismatch on `/meetings` | **FAIL — but pre-existing, not ours** | see below |

#### Hydration mismatch (real, survives a cold rebuild)

`MeetingIntelPanel` → the "Live transcript language" `<Select>`. The client
renders a `<button role="combobox" id="base-ui-_R_38d6...">` that the server
did not render. Reproduced on a **cold build in a fresh worktree** that has
never been built before, so it is *not* the stale-chunk shape described for
`MiniCalendarDay`/`HolidayIcons`.

**Not introduced by this branch.** `main` already contains that Select
(`git show main:...meeting-intel.tsx` matches "Live transcript language"), and
`git diff main integration/2026-08-11` does not touch that block at all. It
looks like a base-ui `Select` SSR id/markup issue and should be filed
separately against main.

#### `SpeakerAssignmentPanel` stuck on "Loading speakers…"

Observed but **not diagnosed**. Most likely `getSpeakerAssignmentData` is
failing against a DB that lacks the 0019 tables. Cannot be confirmed without
0019 applied. Flagging rather than asserting.

### Blocked — NOT TESTED

Everything below is NOT TESTED. `/apps/[slug]` returns a server error before
rendering, because `getSprints` selects `sprints.sort_order`, which does not
exist in the dev database. That page hosts the board, the roadmap and the
inline-edit surfaces, so all of it is unreachable.

| # | Item (coordinator's priority order) | Verdict | Reason |
| --- | --- | --- | --- |
| 1 | Board: drag card between all 3 columns; **`DragOverlay` not clipped at the horizontal scroller edge** | NOT TESTED | `/apps/[slug]` 500s — missing `sprints.sort_order` |
| 1 | Board: click a card opens the dialog | NOT TESTED | same |
| 2 | Board keyboard: `Enter` opens, `Space` lifts, arrows move, `Space` drops, `Esc` cancels | NOT TESTED | same |
| 3 | Roadmap: edge-resize clamping (cannot cross opposite, 1-day floor) | NOT TESTED | same |
| 3 | Roadmap: bar drag shifts dates; grip drag reorders rows | NOT TESTED | same |
| 3 | Roadmap: `Left`/`Right` 1 day, `Shift` a week, `Alt+Up/Down` reorder | NOT TESTED | same |
| 3 | Roadmap: live date tooltip; "Sort by date" resets order | NOT TESTED | same |
| 3 | Roadmap: non-admin sees no drag affordances | NOT TESTED | same, and dev-login is admin-only — needs a second non-admin session |
| 4 | Touch: long-press (200ms) drags, plain swipe scrolls (`MouseSensor`+`TouchSensor`) | NOT TESTED | same — the surface under test is the board |
| 5 | Inline edit: dbl-click / F2 rename on a **task card** and **sprint name**, Enter saves, Esc cancels | NOT TESTED | same |
| 5 | Right-click quick menu, permission-filtered items | NOT TESTED | same |
| 5 | Calendar: drag a meeting chip to another day | NOT TESTED | reachable, but it **writes to the user's 5 real meetings** (which carry transcripts, follow-ups and Google Calendar events). Not done without approval. |
| 5 | Calendar: click empty day cell opens the form prefilled | **INCONCLUSIVE** | a synthetic `element.click()` did not open the dialog, but that is not valid evidence — these surfaces deliberately distinguish click from drag via pointer events, which a programmatic click does not reproduce. Needs a real pointer click. |

### What would unblock the rest

Apply migration `0020_sprint_sort_order` to the dev database (additive:
`ADD COLUMN IF NOT EXISTS` + a 3-row backfill; reversible with `DROP COLUMN`).
That alone makes the board, roadmap, inline-edit and touch checks reachable.
`0019` is not needed for any of them.

## Round 2 — after sort_order was applied to the dev DB (by the coordinator)

`/apps/logpup?tab=board` now renders: sprint switcher, all three columns
(To do 0 / In progress 0 / Done 1), the "this" task card in Done, the a11y
hint "Select a card to open it. Press Space to lift a card…", and add-task
inputs per column. No server error.

| Item | Verdict | Evidence |
| --- | --- | --- |
| Board renders after 0020 (was the hard blocker) | **PASS** | full a11y snapshot of the board tab |
| Click a card opens the dialog | **PASS** | real CDP click on the card → `role="dialog"` titled "Edit task" with assignee/due/priority fields; Esc closed it |
| `Enter` opens the dialog | **PASS** | focused the card, real `Enter` keypress → same "Edit task" dialog opened; Esc closed it |
| `Space` lifts the card | **FAIL — real defect, found in browser, fixed** | see below |

#### Defect: Space-to-lift never worked on task cards

Observed: focused card, real CDP `Space` keypress. Event recorder confirmed
`keydown key=" " code="Space"` arrived **at the card element** — and nothing
happened. No `DragOverlay`, no announcement, no transform; the page just
scrolls (the card is a `role="button"` DIV, so Space has no default
activation to suppress).

Root cause (`task-card.tsx`): `{...listeners}` spreads dnd-kit's `onKeyDown`
activator onto the card, and the card's own `onKeyDown={...}` prop written
**after** the spread replaces it — so the KeyboardSensor's Space handler is
clobbered and only the card's Enter branch survives. The adjacent comment
("The shared drag kit's KeyboardSensor claims Space to lift the card") shows
this was believed to work; the board even instructs "Press Space to lift a
card…". On the roadmap the identical override is deliberate and documented;
here it was accidental.

Fix: the card's `onKeyDown` now forwards to `listeners.onKeyDown` first and
only handles Enter when the sensor didn't claim the event
(`event.defaultPrevented`). This restores the documented behaviour rather
than changing it. Re-tested live after the fix — results below.

| Item | Verdict | Evidence |
| --- | --- | --- |
| `Space` lifts (after fix) | **PASS** | real Space keypress → `DragOverlay` clone appeared (`position:fixed`, z-999), announcement "this is over this." — and the Edit dialog did NOT open |
| Arrow keys move the lifted card | **PASS** | overlay tracked left 815 → 744 → 669 across three/six presses; announcement changed to "this is over the In progress column." |
| `Space` drops | **PASS** | announcement "this moved to the In progress column.", counts went Done 1→0, In progress 0→1, overlay unmounted, no dialog, no error toast |
| `Esc` cancels a lift | **PASS** | lift + 2 arrows + Escape → "Move cancelled. this stays where it was.", counts unchanged |
| Enter still opens (not stolen by sensor) | **PASS** | `keyboardCodes.start` is Space-only; Enter re-verified opening the dialog after the fix was live |
| Mouse drag between all three columns | **PASS** | Done→In progress (keyboard), In progress→To do and To do→Done via stepped mousedown/mousemove×10/mouseup. Overlay visible throughout, "over the To do column" mid-drag, counts moved 1→0/0→1 correctly each time, no error toast (server write accepted). Caveat: the MCP `drag` tool itself sends a single large move, which dnd-kit's `distance: 8` activation consumes — delta 0, no-op ("this moved to this."). The stepped sequence drives the identical MouseSensor pipeline; only the OS input layer is synthesized. |
| **DragOverlay NOT clipped at the scroller edge** (the original bug) | **PASS** | Pinned the board's `overflow-x-auto snap-x` scroller to 420px so it truly clips (its own "In progress" column is visibly cut at the right edge). Held a drag mid-gesture: overlay rect x=48..288 vs scroller visible box x=248..668 — 200px of the drag copy renders **outside** the container, `visibility:visible, opacity:1`, position:fixed z-999 portal. Screenshot taken; the To do column also showed its green drop-target highlight during the drag. Cancelled cleanly, layout restored. |
| Board layout note (pre-existing, not a defect in this branch) | observation | At narrow viewports the board's snap-x container never internally scrolls — it stays content-width (800px) and the **document** scrolls horizontally instead (`html.scrollWidth` 848 vs viewport 500). The overlay fix is structural (body portal) so it is immune either way. |
