# UI Intelligence Redesign — design

**Date:** 2026-08-20
**Scope:** every authed surface (public pages + /sign-in excluded: owned by a parallel session this day). Admin cluster + bugs surfaces deferred to Wave B (parallel session mid-correctness-work there).
**Research:** 8-agent audit, 158 gaps + 51 AI opportunities catalogued — full data in the session scratchpad (`research.json`), condensed here into decisions.

## Subject and stance

LogPup is a bilingual (Sinhala/English) work journal for a small studio: meetings, sprints, people, a daily self-scored worklog. The audit found the visual foundation ("watchdog calm", spec 2026-08-10/11) already token-disciplined and contrast-verified — so this redesign is **not a repaint**. The fresh look comes from composition and behavior:

1. **The palette is the front door.** Every frequent action becomes a ⌘K command; every list teaches its shortcuts; AI answers when search finds nothing.
2. **The worklog becomes a calendar, not a list.** A month you can see — holidays, absences, half-day Saturdays, logged/missing days — with any own day editable in place.
3. **Progress is a place.** A role-scoped `/progress` page answers "who did what, where, how far" for PMs (their apps), editors/leads (scoped + app-level aggregates elsewhere), admins (everything) — using only existing grants (`worklog.view`, `coverage.view`, `app.view`).
4. **States everywhere, honestly.** Every async surface: skeleton matching layout, empty state with next action, error with retry. No spinner-only, no `fallback={null}` layout shift, no error swallowed into a fake empty.
5. **AI assists are labeled, editable, dismissible** — and reuse existing plumbing only (`callGemini` chains, `AI_FEATURES` registry, prefs gating, usage ledger). No new model wiring.

## Avoided defaults

- No palette swap, no gradient/glow "AI slop", no purple-sparkle AI branding — AI affordances use the existing pine `--primary` + a `Sparkles` icon + the word "Draft"/"Suggest"/"Ask".
- No hero cards for data pages; density stays, hierarchy comes from weight/color/mono discipline.
- No new dependencies. Base UI + existing kit only.

## Tokens (additive only — nothing renamed)

- `--overlay`: modal scrim (light `oklch(0.2 0.01 155 / 32%)`, dark `oklch(0.1 0.01 165 / 55%)`) — replaces the kit's only raw color (`bg-black/10` in dialog/alert-dialog).
- Motion: `--ease-enter: cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-exit: cubic-bezier(0.7, 0, 0.84, 0)`; durations `--dur-quick: 120ms`, `--dur-base: 200ms`, `--dur-slow: 320ms`. App-chrome motion only; `--ease-editorial` stays the public-page brand curve, untouched.

## New primitives (src/components/ui)

| Primitive | Why |
|---|---|
| `skeleton.tsx` | Every feature hand-rolls shimmers today; admin built its own file. |
| `tooltip.tsx` | Four icon-only key actions ship sr-only-only labels; sighted users guess. |
| `radio-group.tsx` | Gemini tier picker is the app's only unstyled native control. |
| `empty-state.tsx` | Icon + message + next-action, one shape for ~14 hand-rolled variants. |
| `kbd.tsx` | Three divergent kbd chips (sidebar, palette footer, command hint). |
| `page-header.tsx` | h1 + description + actions row; fixes heading-order drift per page. |
| `stat-tile.tsx` | Linked stat tiles (dashboard "Overdue 3" currently links nowhere); mono numbers, worded deltas. |

Primitive fixes: dialog/alert-dialog overlay → `--overlay`; switch off-grid `h-[18.4px]` → 4px-grid sizes; `CardTitle` gains `as` prop (heading-capable); command.tsx exposes size variants instead of `!important` escalation.

## Worklog rethink (priority surface, user-directed)

**Layout:** two-pane on lg (calendar + day panel), stacked on mobile.
- **Month calendar** (react-day-picker on existing `ui/calendar`): each day cell carries state — logged (pine, opacity ∝ percent), missing-owed (ember ring), absence (existing absence tones), gazetted/org holiday (`--holiday`), mercantile (`--mercantile`), weekend (`--weekend`), half-Saturday (half-fill via `workingDayFraction`). Colors never alone: dot + sr-only text per state.
- **Summary strip** (StatTiles): expected working days this month (via `working-days.ts` + holidays − approved absences), logged days, coverage % (existing `computeCoverage`), streak. **Days, never fabricated hours** — percent is a self-score of "what I planned", not time; presenting it as hours would lie.
- **Day panel:** click any own day → the existing form (slider + note + Draft with AI) for that day. Editing a logged past day = same self-only upsert path; `worklog.write.own`/`worklog.backfill` stay the only write grants. No admin on-behalf writes, ever.
- **Catch-up:** "Draft all N owed days" fans out existing `draftWorklogNote(day)`; each draft lands in its day's form for review — never auto-saves.
- **Percent honesty:** slider starts unset ("not scored yet"), not a silent 50. Draft action extended to propose a percent from the day's activity, shown as a labeled suggestion chip.
- **AI:** natural-language absence ("sick Mon–Tue") prefills the dialog via structured-output Gemini, same prefs/registry pattern as worklog-draft. Admin team view gains a 3-bullet Gemini week digest.
- **⌘K:** worklog gets `commands.ts` — Log today / Declare absence / Draft today's note — and a search provider over own notes.

## /progress (new page)

Answers "each person, app, sprint, time, work progress" per role, read-only:
- **Gate:** `can(actor, 'worklog.view')` + scope from `scopeSourceFor` — admin/superadmin/auditor: all people; manager: people on `managesApp` apps; editor: assigned apps' people; member: redirected to /worklog (own view is already there).
- **People × days matrix** (fortnight default): coverage cells reusing the calendar's day-state language; row = person (name links to /people/[id]), summary = `formatCoverage`.
- **Apps lane:** per visible app — sprint progress (existing sprint queries), open bug count, last activity. Apps outside scope but `app.view`-visible show **aggregates only** (no per-person rows) — that is the "partial" tier, derived from existing grants, no new capability rows.
- **Filters in URL** (person/app/range), Suspense-split, skeletons, error boundary, empty states.

## Per-surface fixes (fan-out wave)

Each surface agent receives its group's full gap list from research.json and fixes ALL of them plus its AI ops. Highlights:
- **Dashboard:** error.tsx (missing on the most-visited route); loading.tsx rebuilt to match the zones layout; stat tiles link to their answering rows; PAIRED_CARDS collapses to child count; palette-visible focus rings on all card links.
- **Activity:** search input keeps focus across debounce commits; "My changes" one-click chip; date presets (Today/7d/This month); Load older appends instead of replacing.
- **Meetings/People/Apps-Sprints:** per group's gap list (14/20/17 items) — states, fixed-width responsive breaks, focus management, cmdk registrations, AI ops (bulk paste-to-tasks in composer, attendee suggestions already specced elsewhere).
- **Settings/Profile:** the AI setup loop (verdict on /settings, keys on /profile) unified onto one surface; optimistic feature toggles (match ai-model-select's pattern); per-row pending instead of one global isPending; AI toggles become palette commands.
- **Shell/palette (main agent):** command-center error state distinct from empty; skeleton result rows; first-run teach rows; "What's new" command; consolidated shortcuts overlay (?); touch targets ≥44px on the phone header row; named nav landmarks; "Ask AI about 'query'" fallback row when search misses, via Quick chain, registered as an AI_FEATURES entry so Settings prices/toggles it for free.

## Non-negotiables carried from repo law

Soft deletes everywhere; identity colors via `event-color.ts` only; Asia/Colombo day math; bilingual copy never force-translated; Base UI Select always gets items function children; load-bearing Gemini/billing copy (per parallel-session inventory) keeps exact meaning; registry wiring done by its owning session — this sweep only adds feature-side `commands.ts`/`search-providers.ts`.

## Verification

Per phase: `npm run lint`, `npm run test`, `npm run build` on current main; three review lenses (React correctness / WCAG 2.1 AA / visual craft) via fresh-context agents; no horizontal scroll at 320px; ⌘K reachable everywhere; every changed surface keeps or adds empty/loading/error states. Pre-existing reds (live.test.ts apps offenders) are tracked as not-mine, not fixed silently.
