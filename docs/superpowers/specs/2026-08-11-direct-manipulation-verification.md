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
