# The Dossier Docket — /meetings list view redesign

2026-09-01. Applies to `/meetings?view=list` only; calendar views (`week`/`month`/`day`/`agenda`) unchanged and reachable exactly as today.

**Subject + audience + job.** LogPup's meetings page for a bilingual (Sinhala/English) EPC software team. The list view's single job: answer "what needs me, and what did each meeting produce" in the first ten seconds, then open any meeting's full intelligence without losing the list.

**Thesis.** The page becomes a fixed-height, day-grouped *docket* whose every intelligence fact arrives in ONE batched, per-id-permission-gated glance response before the user can scroll; the header stat tiles ARE the filters; the 4,800-line `MeetingIntelPanel` moves — untouched — into a right-side *Dossier sheet* driven by the existing `?open=` URL contract; and the page's most frequent gesture (answering an RSVP) gets faster, not hidden. **Computed-only page contract: no Gemini call ever fires to paint /meetings.**

Derived from the 2026-09-01 research brief (12 ranked pain points; fixes 1, 2, 3, 4, 5, 6, 9, 10, 11, 12 — defers 7-persistence and 8, which live inside directive-frozen intel internals).

## Palette / type / signature

No new tokens, no new hues. Everything from the existing watchdog-calm system (`docs/superpowers/specs/2026-08-10-logpup-design.md`): five chip tones only, state always outranks identity, per-app identity exclusively through the audited `--event-1..8` ramp via `event-color.ts`. Data values `font-mono tabular-nums`. Hairline `ring-1` elevation for structure; the Dossier sheet is the page's only shadow and only floating layer. **Signature element: the docket** — one `ring-1` group container per section, rows separated by hairline `divide-y`, each row carrying a 3px app-identity left tick (stacked segments for multi-app; absent for all-hands `[]`; replaced by the live ring when live).

**Avoided defaults:** the deleted glassy stat-card strip + `blur-3xl` ambient orbs (craft-ban violations); tall cards-in-a-void lists; hover-revealed actions; stretched-link `::after` rows; spinners; per-row error chips; sparkle-iconed "AI" decoration.

## Page zones (8 pre-list zones become 4)

1. **Command header** (one line): h1 "Meeting Intelligence" + Suspense-wrapped `MeetingLoadLink` (size-matched fallback, contract kept) + the Quick note / New meeting split pill (Quick note keeps private-from-birth, swallowed Google-invite warning, `?view=list&open=id` navigation — now landing in the sheet). Right-aligned mono summary line "This week: 6 meetings · 4h 30m invited" (Suspense, size-matched fallback) replaces `InvitedHoursTile`. Stat card + orbs + `getMyPendingInvites` paragraph deleted.
2. **Triage rail — tiles ARE the filters**: four `StatTile` `href` links: **Waiting on you** (from `isAwaitingViewerRsvp`, synchronous, enabled immediately) · **Overdue actions** · **Open follow-ups** · **Questions unanswered** (`glance.questions`, surfaced for the first time). Each writes `?view=list&f=waiting|overdue|followups|questions`; active tile gets ring-primary + `aria-current`; pressing the active tile clears it. Counts fill from the one glance batch in one repaint; until then, glance-backed tiles show size-matched pulse skeletons ("Counting…", disabled). All-zero after resolve → rail collapses to one success-tone line "All clear — nothing is waiting on you". Batch error → mono em-dash values + one worded "Counts unavailable — Retry" notice.
3. **YourSeries disclosure** (organizer-private, renders only when non-empty, Suspense kept): one line "Series suggestions (N) — Review", expanding the existing card in place.
4. **Control rail** (client, sticky top, `ring-1`, `bg-card`): view switcher (unchanged component + `?view` contract) · client-local search input · the MiniCalendar 30-day strip **verbatim** (roving-tabindex composite survives byte-for-byte) · new **JumpToDate** popover writing `?day=YYYY-MM-DD` (re-anchors `stripStart`, auto-expands Past for past dates, out-of-window picks trigger the targeted by-day fetch). Quick-filter chips are gone from this rail — they are Zone 2.
5. **h2 "Upcoming"** — the docket. Day labels ("Today · Mon Sep 1") are **styled divs, not headings** — the h1→h2(Upcoming/Past)→h3(row title)→h4(panel sections) outline survives byte-for-byte. Live meeting sorts to top of Today per `splitByUpcoming`; live ring stays the sole structural color. True-empty keeps today's `offerCreate` + users-pool gate + copy; filtered-empty is distinct ("No meetings match <filter/day>" + Clear).
6. **h2 "Past (N)"** (collapsible as today; N from a cheap count, so the header never lies): same rows, month-label divs ("August 2026"). Server returns newest 20; "Show earlier meetings" cursor-pages, swapping to layout-matched ghost rows while loading. Honors `?day` and `?f`; an out-of-window `?day` triggers the targeted fetch rather than silently showing nothing.
7. **Dossier sheet** (overlay, not in flow): `role=dialog`, right side, `min(720px, 92vw)`, full-screen below `lg`, mounted only while `?open=id`. Slides 200ms transform+opacity on `--dur/--ease` tokens; fade-only under reduced motion.

## Row anatomy (one fixed anatomy, ~56px desktop / two-line 64px mobile)

`<article aria-labelledby>`; height never changes; `MeetingIntelPanel` NEVER mounts here. Left→right:

1. **App-identity tick** — 3px left edge via `event-color.ts` (stacked for multi-app, absent for all-hands). Identity never carries alone: app names render as text `Badge` chips after the title on ≥lg and always in the sheet header.
2. **Time column**, fixed-width mono tabular-nums: "2:00 PM" over "45m"; live rows show pulse dot + "Now" (active tone). `sr-only` `<time>` with the full ISO date on every row.
3. **Main cell**: h3 title; the title-block (title + time line) is one ≥44px **button** opening the sheet — no stretched link, no hover-gated affordances. Lock icon + `sr-only` "Private — attendees only" when `visibility='attendees'`. Desktop-only second line: `line-clamp-1` agenda snippet, `bilingualText` + `break-words` (CSS clamp — Sinhala graphemes never cut by JS).
4. **Chip line**, strict priority, state first: TimingChip only when live/soon (group label already says the day) → "N overdue" (danger) → "N stuck" (danger) → "N open follow-ups" (warning) → "N questions" (neutral) → "Notes" (success) / "No notes yet" (warning, past rows only) → "Reconvenes Sep 12" via `describeNextMeeting` (human-confirmed `next_meeting_at` only) → "Invite sent". Desktop caps at 5 chips + "+N" overflow; mobile top 3. Every count chip is a button deep-linking `?open=id`. Glance tri-state: `undefined` = fixed-width pulse `SkeletonBlock`; `null` = nothing; batch failure = NO per-row chips (the list-level notice owns the error). Five existing tones; every tone carries a word or icon.
5. **People cluster**, right-aligned: `AvatarGroup` slice(0,5) + the kit's `AvatarGroupCount` "+N"; declined wear a small danger x badge, pending a hollow ring — tooltip AND `sr-only` naming person + response; aggregate "4/7 going" chip via `tallyRsvps`.
6. **Action cluster, always visible**: inline compact Yes/Maybe/No RSVP rendered ONLY when the viewer's own response is pending (`isAwaitingViewerRsvp`); then a 44px kebab: Add to calendar, Edit (`canManage`), Delete (admin, soft), "Schedule follow-up" (past + has notes + no `next_meeting_at` — deterministic `MeetingForm` prefill, no AI).

Mobile: time merges into title line ("2:00 PM · 45m"), avatars collapse to "+N", RSVP + kebab stay 44px.

## Intel handoff (the Dossier sheet)

Title block, any count chip, Enter on the focused row, and every existing `?open=` deep link (palette, Quick note) write `?open=<id>` via the History API with render-time param derivation — the identical URL contract. `MeetingsViews` mounts `MeetingIntelSheet` (precedent: `meeting-detail-dialog.tsx`): focus-trapped dialog; sticky identity header (h3 title, full mono date/time/duration, app badges, Private badge, full un-clamped agenda — now reachable by every viewer — facepile with per-person RSVP marks, `MeetingRsvp` + `AddToCalendarMenu` + Edit/Delete behind the same gates, Prev/Next stepping `?open=` through the current filtered order: first open pushes state, stepping uses `replaceState`). Below: `MeetingIntelPanel` UNCHANGED, keyed by meeting id, `autoOpen` one-shot, exact props today's row threads; 11 panels in documented order; `record`/`plan-the-meeting` collapsed cost-guards intact; exactly ONE panel instance exists at a time, so the planner's health pass runs at most once per open sheet by construction. `onGlanceChange` writes through to the shared glance store — chips, tiles and panel can never disagree. Viewers without intel permission get the identity header only, no hint naming hidden controls. Esc / X / backdrop / Back close and strip `?open`; docket never reflowed, focus returns to the originating row. `?open` always wins over a hiding `?f` — sheet renders, list keeps the filter. Rows never mount the panel, so the 300px-prefetch 30× transcript sweep dies without touching `meeting-intel.tsx`.

## URL grammar + staleness

`?view=list&day=YYYY-MM-DD&f=waiting|overdue|followups|questions&open=<id>` — all via History API, render-time derivation (never the effect form). `?f` single-select; "stuck" stays a row chip, not a filter. `?day` filters BOTH Upcoming and Past and composes with `?f`; tile counts computed over the whole list, never the day slice. Search is client-local (no URL/history thrash). **Boundary-crossing clock** (pain 10, inside the day-coarse hydration constraint): one client-only timer, armed post-mount, computes the next `startsAt`/`endsAt` boundary among rendered meetings and refreshes the single shared `now` at exactly that instant — labels stay day-coarse, one clock read per render, a handful of ticks per hour.

## States

- **Loading**: docket renders immediately from `listMeetings` facts (time/title/apps/people); tiles + row chip slots pulse at final size; the batch resolves into ONE repaint. Ghost rows for "Show earlier". Pulse always, spinners never.
- **Empty**: true-empty keeps the dashed offerCreate card; filtered-empty distinct with Clear action; all-clear rail line is the designed success state.
- **Error**: batch-glance failure = ONE designed state — neutral notice above the list, icon + words + Retry; tiles em-dash; rows degrade to identity/people facts; glance-backed filtering disables. `listMeetings` failure hits the page error boundary. Permission-denied stays `null` by design (indistinguishable from nothing-to-show — counts never leak).
- **Mobile**: rail becomes 2×2 tile grid; control rail stacks; strip scrolls in its own overflow-x container (never the body); sheet full-screen. Reduced motion: fades.

## Data contracts (pin these — implementers build to them)

All new reads viewer-scoped from session (never viewerless), `liveMeetings`-scoped, hydrates via the batched `attachAttendees`/`attachApps` pattern (never joins). **No schema migrations.**

```ts
// NEW src/features/meetings/glance-actions.ts ('use server')
// Per-id gate: canReadMeetingIntel (admin | creator | PM of any meeting project | attendee);
// denied/unknown ids → null. Cap 100 ids (excess ids → null + server warn). NEVER throws:
// failure returns { ok: false }. Constant number of statements — batch the underlying reads
// across all ids in single IN-clause queries, then run the SAME pure helpers
// (glanceFromIntel or its shared internals) per meeting in JS. Never N getMeetingIntel builds.
export async function getMeetingGlances(meetingIds: string[]): Promise<
  { ok: true; map: Record<string, MeetingGlance | null> } | { ok: false }
>

// EXTEND (meeting-notes-model.ts, inside glanceFromIntel — the documented extension point):
// MeetingGlance gains `nextMeetingAt: Date | null`. (`questions` already exists.)
// NO viewer-scoped fields enter MeetingGlance.

// EXPORT (meeting-glance.ts): the ONE pending-RSVP source — tile, nudge, inline-RSVP condition.
export function isAwaitingViewerRsvp(
  meeting: { attendees: { id: string; response: AttendeeResponse }[] },
  viewerId: string,
): boolean

// queries.ts — NEW alongside listMeetings (which stays untouched for other callers):
export async function listMeetingsWindowed(viewerId: string, opts?: {
  pastLimit?: number            // default 20
  pastCursor?: { endsAt: string; id: string }
}): Promise<{ upcoming: MeetingSummary[]; past: MeetingSummary[]; pastTotal: number }>
export async function getMeetingsForDay(viewerId: string, day: string): Promise<MeetingSummary[]>
export async function getMeetingSummaryById(viewerId: string, id: string): Promise<MeetingSummary | null> // out-of-window ?open

// NEW src/features/meetings/list-actions.ts ('use server') — session-resolved wrappers:
export async function fetchOlderPast(cursor: { endsAt: string; id: string }):
  Promise<{ ok: true; meetings: MeetingSummary[] } | { ok: false }>
export async function fetchMeetingsForDay(day: string):
  Promise<{ ok: true; meetings: MeetingSummary[] } | { ok: false }>

// NEW pure modules + tests:
// src/features/meetings/list-filter.ts — parseListFilter(value: string | null): ListFilter | null;
//   matchesListFilter(filter, meeting, viewerId, glance: MeetingGlance | null | undefined): boolean
// src/features/meetings/list-search.ts — filterMeetingsBySearch(meetings, query): MeetingSummary[]
//   NFC-normalized lowercase substring over title/agenda/attendee names/app names.
//   NO word-splitting regexes; \p{M} and ZWJ survive (Sinhala rules).
```

Client store — NEW `src/features/meetings/components/use-glance-map.tsx`: a client `MeetingGlanceProvider` receiving the **un-awaited** `getMeetingGlances` promise from the page (page invokes once, does not await), resolving it in a mount effect into a tri-state map (`undefined` pending / `null` / `MeetingGlance`) so the whole list fills in one repaint; exposes `{ glances, status: 'pending'|'ready'|'error', retry, mergeGlance }` via context; also owns the boundary-crossing clock (`useListNow()`). TriageRail and the list both consume this context — one truth. (Deliberate deviation from the panel's `use()`+Suspense sketch: same one-repaint UX, one error surface, no per-tile suspension.)

**Tests required**: leak test (visible-but-intel-denied meeting → `null`), parity test (batch output deep-equals `glanceFromIntel(await getMeetingIntel(id))` per meeting, sharing Asia/Colombo overdue math), `isAwaitingViewerRsvp`, `parseListFilter`/`matchesListFilter`, Sinhala-safe search, past-cursor windowing.

**Flagged, gated, NOT in this build**: dropping `notes` from the `listMeetings` select (amends the MeetingSummary contract — needs a consumer sweep + sign-off).

## File plan

New: `glance-actions.ts` (+test), `list-actions.ts`, `list-filter.ts` (+test), `list-search.ts` (+test), `components/use-glance-map.tsx`, `components/triage-rail.tsx`, `components/jump-to-date.tsx`, `components/meeting-intel-sheet.tsx`.

Edit: `page.tsx` (header collapse, glance kickoff, windowed query), `meetings-views.tsx` (`?f` parse, sheet mount, `?open`-wins, focus return), `meeting-list.tsx` (row rewrite, day groups), `upcoming-filter.tsx` (chips out, search in, JumpToDate; fix the false eager-fetch comment), `past-meetings-section.tsx` (month groups, cursor paging), `meeting-chips.tsx` (chip priority/overflow helpers; Reconvenes/questions chips), `meeting-glance.ts` (export predicate), `meeting-notes-model.ts` (`nextMeetingAt`), `queries.ts` (windowed reads), `commands.ts` (Quick note descriptor).

Untouched (load-bearing): `meeting-intel.tsx`, `meeting-panels.tsx`, `meeting-planner.tsx`, `meeting-prep.tsx`, `split-upcoming.ts`, `event-color.ts`, `next-meeting.ts`, `search-providers.ts`, everything in `src/components/ui/*`.

## Deferred (recorded, not forgotten)

Planner persistence (constraint change, product decision); intel-internals cost bugs (global panel-collapse keys, un-gated `getMeetingPrep`); `notes` column drop (contract gate); density toggle; cross-user glance staleness (optional re-fire on sheet close); post-hoc RecordingTakes list; "stuck" as a fifth tile.
