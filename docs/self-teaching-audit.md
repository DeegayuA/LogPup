# Self-teaching audit

**Date:** 2026-08-19 · **Scope:** every route under `src/app/(app)/` plus the shell, read-only.
**Question asked of each screen:** can a brand-new user answer these from the UI alone?

1. What is this screen for?
2. What is the one action I should take right now?
3. What happens after I take it?

**Headline:** this is not a bad-copy problem. Prose quality across the app is unusually high — most
empty states already explain themselves in plain language, and several surfaces (worklog catch-up,
activity fuzzy-fallback banner, plan-read strip, app health reasons) actively teach. The gaps are
structural: **the app never speaks to a user who has done nothing yet**, **empty states describe
instead of offering**, and **capability is invisible — nobody is told what is theirs to do**.

---

## 1. Screen-by-screen

| Screen | Q1 what is it | Q2 next action | Q3 what happens after | What a new user misreads |
|---|---|---|---|---|
| `/` Dashboard | ✅ greeting + zone labels (My day / Team / Portfolio) | ❌ nothing. Four zero tiles and four empty cards with no control in any of them | ❌ | A fresh account reads as "the app is empty/broken", not "you have not logged anything yet". Nothing points at Work log — the one daily habit the product exists for |
| `/worklog` | ✅ best screen in the app: title, date, "one line about your day, and how far you got" | ✅ slider + note + **Log the day** | ⚠️ toast "Logged", button becomes **Update**. Where the entry then shows up (team view, dashboard, drafts) is not said | A first-timer with no owed days sees only today's box — the rules (Sundays/holidays skipped, Saturday half, 10-day backfill cap) live in the catch-up panel, which renders **only when they are already behind** |
| `/apps` | ✅ "Every product the team is building" | ⚠️ admin: **New app**. member: nothing clickable in the empty state | ✅ empty copy tells admins what the page becomes | Members are told "an admin can add the first app" — good — but nowhere learn what they *can* do on an app |
| `/apps/[slug]` | ✅ header + health + tab nav | ⚠️ depends on tab; Roadmap for a member is read-only with no statement of that | ⚠️ | Tabs are 6 wide (overview/roadmap/discussion/meetings/activity/settings) with no first-visit orientation; Settings simply does not exist for members, with no trace |
| `/people` | ✅ "what everyone is working on right now" | ⚠️ implicit (click a person) | ❌ | "Capacity"/"allocation %" are never defined at first contact |
| `/people/history` | ✅ strong subtitle, states the window | ✅ pickers/filters visible before data | ✅ footnote about roster vs allocations | "moved / window / compare" needs one read-through; `movedOnly` filter is unexplained until used |
| `/people/[id]` | ✅ name + stat strip | ❌ read-only page, never says so | n/a | Nothing states that you cannot edit another person's work, or that their worklog is theirs alone to write |
| `/meetings` | ✅ "everything the pack has scheduled" | ✅ **New meeting** | ⚠️ | Stat row hides entirely when `total === 0` — the emptiest state has the fewest cues. Calendar/list/agenda view switching is undocumented |
| `/activity` | ✅ describes the exact slice being shown | ✅ filter bar; empty state offers **Clear all filters** / **Go to apps** | ✅ | Best-in-app empty handling. Only gap: no `G` shortcut despite being in nav |
| `/admin` | ✅ "workspace-wide tools… tread carefully" | ✅ each card names its action | ✅ danger zone is explicit | Fine |
| `/profile` | ✅ | ✅ per card | ✅ | Overlaps `/settings`; the split is explained by a footnote *on the other page* |
| `/settings` | ✅ "how LogPup behaves for you" | ✅ | ✅ | Same overlap, opposite direction |

---

## 2. Empty states

46 dashed-border blocks exist; ~40 are genuine empty states (the rest are composer/status
decoration). Classification by whether the block **renders a control**:

**Offers an action (7):** `/activity` (clear filters / go to apps), `apps-browser.tsx:239`,
`notifications-card.tsx:57`, `meeting-panels.tsx:584` (clear filter), `upcoming-filter.tsx:123`,
`board.tsx:453`, `directory.tsx:255`.

**Prose-only dead ends (selected, verbatim):**

| Location | Copy | Why it is a dead end |
|---|---|---|
| `people/page.tsx:12` | "Nobody in the pack yet." | Admin reading this has **Add user** one page away, unlinked |
| `apps/page.tsx:60` | "No apps in the kennel yet." | Admin has the button above; member gets no onward path |
| `apps/[slug]/page.tsx:540` | "Nothing to fetch here yet" | Member branch offers nothing at all |
| `worklog/page.tsx:222` | "Nobody has logged a day yet this week." | Admin-only; no nudge action |
| `team-panel.tsx:74` | "No one's on this app yet." | Assigning is the action; not offered here |
| `app-comments.tsx:71` | "No comments yet. Start the conversation…" | Composer is nearby but not focused/linked |
| `app-contributions.tsx:77` | "Nothing to measure yet." | — |
| `recent-activity-card.tsx:36` | "Nothing tracked yet." | — |
| `meeting-list.tsx:85` | "No meetings." + "Schedule one to get the team in sync." | Describes the action, does not offer it |
| `meetings-agenda.tsx:69` | "Nothing scheduled this month." | Same |
| `profile/page.tsx:89`, `settings/page.tsx:165`, `gemini-keys-card.tsx:93` | job role / Gemini key | Correctly prose-only (nothing the user can do) |

**Root cause, and the highest-leverage fix in the whole audit:**
`src/features/people/components/section-empty.tsx` — the shared empty state, used at **9 call sites across 7 files**
(every My Day card, every person-page card, capacity history views) — takes `icon`, `title`,
`hint` and **has no action slot**. Its own doc comment says "an empty state with nothing but a
headline is a dead end", and it then makes offering an action structurally impossible. The entire
My Day zone of a new user's dashboard is rendered through it.

---

## 3. Controls whose purpose is not readable from the UI

| Control | Where | Problem |
|---|---|---|
| `G` + key nav shortcuts | `sidebar.tsx:52` (`group-hover:inline`) | Only visible on hover/focus of the row — invisible on touch, invisible to anyone who does not hover. `/activity` has no key assigned at all (`nav-items.ts`) |
| ⌘K "Fetch anything" | sidebar footer (`hidden md:flex`) + header trigger | The palette accepts a **whole sentence** ("shanika fix login by friday") and creates a task; the placeholder says "apps, people, tasks…" so nobody discovers it |
| Board task composer | `task-composer.tsx:154` placeholder "Add a task…" | Same parser (`lib/task-intent.ts`) — natural-language assignee/date/priority; the live preview teaches *after* you type, but nothing invites the first attempt |
| Toggle go-to shortcuts | `command-center.tsx:698` | The palette can toggle `g`-shortcuts but never **lists** them; there is no `?` sheet anywhere in the app |
| Roadmap spine vs full timeline | `apps/[slug]` `LazyDisclosure` | Handled well (`summary` + `hint` differ by role) — use this as the pattern elsewhere |
| Worklog % semantics | `worklog-form.tsx` explains it; dashboard/`people` tiles reuse the number without the sentence | Same figure, two surfaces, one explanation |
| "At risk", "check-in gap", "capacity", "allocation" | apps/people/dashboard | Verdict words with no first-contact definition (app overview's *reasons* list is the good counter-example) |

---

## 4. Role differences and what the UI reveals

Schema has **two roles only** — `pgEnum('user_role', ['admin','member'])` (`src/db/schema.ts:8`).
There is no `editor` role in code; per-app PM/lead (`app_role_history`, `lib/project-roles.ts`) is
the second, orthogonal axis.

Admin-only capability is **hidden without trace** at every site: New app / Edit app
(`apps/page.tsx:50`, `apps/[slug]/page.tsx:330`), New sprint (`:483`, `:547`), Notion export
(`:480`), sprint status select (`:491`), the **Settings tab itself** (`:93`), capacity editing
(`capacity-heat.tsx:42`), task edit (`task-card.tsx:301`, `task-dialog.tsx:402`), roadmap
drag/edit (`roadmap-timeline.tsx`), team worklog (`worklog/page.tsx:66`), admin nav + palette
actions.

Hiding is the correct security posture and mostly fine for learning. The **real** gap is the
opposite direction: **no surface tells a member what is theirs.** Worklog writes are self-only by
design (no admin-on-behalf, first-person record) — that is a genuinely surprising, teachable rule
and it is stated nowhere in the UI.

---

## 5. Places a missed day reads as failure

- `worklog/page.tsx:184` — the catch-up panel is `border-warning/40 bg-warning/5` with
  "N days still need logging". For someone returning from leave or a stint on another project,
  every absent day is presented as debt. The copy is careful (holidays excluded, Saturday half,
  capped backlog) but the **tone and colour are a warning**, and there is no way to say
  "I was not working".
- `worklog/page.tsx:245` — "Not logged" per row is neutral. ✅
- `worklog/page.tsx:229` — "N logged · averaging X% on the days you logged" is correctly
  gap-tolerant. ✅
- `people/[id]` activity heat map and capacity trend read absence as low output with no
  leave concept.

**No leave / off-project / non-working-day-for-me state exists in the data model** (`dailyWorklogs`
has `day`, `percent`, `note`; working-day logic is calendar-wide in `lib/working-days.ts` +
`lk-holidays.ts`). Per the agreed scope this is recorded as a **follow-up, not built** — it needs a
schema decision, and migrations are out of scope for this pass.

---

## 6. Ranked fix list

| # | Fix | Files |
|---|---|---|
| 1 | Add an optional `action` slot to `SectionEmpty` and fill it at the dead-end call sites (tasks, follow-ups, meetings, contributions, team panel, capacity views) | `src/features/people/components/section-empty.tsx` + 16 call sites |
| 2 | **First-log nudge** on the dashboard for a user with zero worklog entries — reuse the existing one-time-hint pattern exactly: server component + cookie dismissal, no client flash, no schema change | new `src/features/worklog/components/first-log-nudge.tsx` modelled on `src/features/auth/components/passkey-nudge.tsx`; mounted in `src/app/(app)/page.tsx` |
| 3 | Worklog: state the rules **before** someone is behind (one line under the header, not only inside the warning panel), and say where the entry goes | `src/app/(app)/worklog/page.tsx` |
| 4 | Neutralize the catch-up panel's failure tone; keep the list, drop the warning colour, name leave/other-project as legitimate reasons a day is blank | `src/app/(app)/worklog/page.tsx:184` |
| 5 | One "what you can do here" line per gated surface, role-aware, reflecting existing checks only — including the member-facing statement that a worklog entry is self-only | `apps/[slug]`, `people/[id]`, `worklog`, `dashboard` capacity card |
| 6 | Make the keyboard layer discoverable: always-visible `G`-key affordance (not hover-only), a `?` shortcut sheet listing them, and a `key` for Activity | `src/components/shell/sidebar.tsx`, `src/components/shell/nav-items.ts`, `src/features/search/components/command-center.tsx` |
| 7 | Teach the natural-language capture at the two places it exists, via example placeholders | `command-center.tsx:419`, `task-composer.tsx:154` |
| 8 | Define the verdict vocabulary at first contact (percent, capacity, at-risk, check-in gap) — one hint line per stat strip, reusing existing `hint` conventions | `person-stat-row.tsx`, `portfolio-summary.tsx`, `capacity-heat.tsx` |
| 9 | Meetings empty states: offer the action instead of describing it | `meeting-list.tsx:85`, `meetings-agenda.tsx:69`, `/meetings` stat row when `total === 0` |
| 10 | Profile ↔ Settings: make the split legible from **both** pages | `src/app/(app)/profile/page.tsx` |

**Deferred (needs a decision, not code):**
- Leave / off-project day state — schema change, out of scope here.
- Meetings intel/notes (`meeting-intel.tsx` ~4k lines) — its own audit; too large to fold into a
  workspace-wide pass.
- `editor` role from the RBAC design spec — not in the schema, so nothing to teach yet.

---

---

## Status — applied 2026-08-19

| # | Fix | State |
|---|---|---|
| 1 | `SectionEmpty` action slot | **Done.** Optional `action` added; filled on person-tasks (`totalCount === 0` only), person-meetings, and the three filter-caused capacity-history empties. Deliberately NOT filled on good-news empties ("nothing outstanding", "nobody over capacity") or on `assignments-card`, whose next step is admin-only and whose props carry no role. Real usage was 9 call sites across 7 files, not 16 |
| 2 | First-log nudge | **Done.** `first-log-nudge.tsx` + banner, cookie-gated server component modelled on `passkey-nudge.tsx`, mounted on the dashboard. Shows only at zero worklog entries. No schema, no localStorage |
| 3 | Worklog rules up front | **Done.** Always-visible line under the header: which days count, the backfill cap, where a saved entry lands, and that entries are self-only. The catch-up panel no longer repeats it |
| 4 | Catch-up tone | **Done.** `border-warning/40 bg-warning/5` → `border bg-muted/40`; heading is a count, not a debt. Copy now names what actually clears a day (any entry, including one saying it was leave) rather than sanctioning a blank that nothing ever resolves |
| 5 | Role legibility | **Done.** Roadmap tab states what this viewer may change, derived from `createTask` / `canMoveTask` / `requireAdmin`, and renders only when the board is on screen. `/people/[id]` states it is a read-only record and names where allocations and tasks are edited |
| 6 | Keyboard discoverability | **Done, then handed off.** `/activity` got a key; the palette's shortcut map is derived from `nav-items.ts` (the old hand-written map had drifted — the sidebar advertised "G W" while nothing listened for it); chips list every jump without hover, hidden below `sm`. The file is now being rewritten by the session that owns the search refactor |
| 7 | Natural-language capture | **Done.** Palette placeholder shows a parsing example. The board composer keeps a purpose-first placeholder — its focus hint already taught the syntax, and spending the only visible label on syntax made the field read as content |
| 8 | Number vocabulary | **Partial.** One line on the capacity card. The stat-strip captions were reverted: the `%`-gated sentence was false on the `headroom` tile (unallocated capacity, routinely 300–500%) and on `avg-load` (a team mean), and it shifted layout against two loading skeletons |
| 9 | Meetings empties | **Done.** Both empty states offer creation; creation is opt-in per list (`offerCreate`) so a past-scoped or app-scoped list cannot offer a meeting that would land where the reader is not looking. The past section no longer renders a second empty state under its own |
| 10 | Profile ↔ Settings | **Done.** `/profile` now names what `/settings` holds, mirroring the existing footnote |

**Fixed along the way, found by review rather than planned:**
- `upsertDailyWorklog` had no `revalidatePath`, so a saved entry left the list below reading "Not logged" — the page's own copy was false until this was added.
- `worklog-form.tsx` hardcoded `id="worklog-percent"` / `id="worklog-note"`, so every catch-up form's labels focused the first box's controls. Now `useId`-derived.

**Still open, needs a decision rather than code:**
- Leave / off-project / not-a-working-day state — no field exists on `dailyWorklogs`; copy currently routes around it by asking people to log the day as leave.
- `meeting-intel.tsx` (~4k lines) — its own audit; too large for a workspace-wide pass.
- The `editor` role from the RBAC spec — not in the schema, so there is nothing to teach yet.

