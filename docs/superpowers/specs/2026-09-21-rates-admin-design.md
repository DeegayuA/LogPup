# The Rates Desk — /admin/rates

2026-09-21. New admin surface. No schema migrations. No new dependencies.

**Subject + audience + job.** The two admin seats (superadmin, admin) that hold `finance.view`. Its single job: make the three money tables *settable*, so `/admin/insights` stops printing "no rate set" on every project. Today `rate_cards`, `person_rates` and `project_value` are empty because `src/features/finance/rate-actions.ts` exports five working, gated actions **that nothing in the repo calls**. This page is the caller.

**Thesis.** A form-heavy admin surface in the shape `/admin/holidays` already established — thin server page, `can()` gate, one Card per concern, native `<Input type="date">`, `useTransition`, `AlertDialog` for the destructive confirm, `toast` for success — extended with the one discipline holidays does not need: **the number never leaves the page.** Rates are as-of intervals, so every section shows *what is in force now* plus *what it used to be*, and the only writes are "open a new interval" and "close the open one". No action, no chart, no palette row, no notification and no activity-log entry ever carries a figure.

## The privacy finding that shaped this (verified, not assumed)

The brief asked whether any action writes a dollar amount into `activity_log`. **It does not.** All five `logActivity` payloads in `rate-actions.ts` were read line by line — L133-141, L181-188, L243-252, L296-303, L396-412. None contains `hourly`, `contractValue` or `subscriptionMonthly` in `entityLabel`, `detail` or `metadata`; they carry a role name, a person's name, a currency code, and dates. The file header (L33-43) states this as a rule and gives the reason: `activity.view` reaches superadmin → member (`capabilities.ts:201`), far wider than `finance.view` (admin/superadmin only, `capabilities.ts:230`).

So there is **no strip to perform**. The risk is the opposite one — a future edit adding an amount to a payload that currently reads fine. `src/features/finance/` has **no** `rate-actions.test.ts` today (only `cost.test.ts`), so nothing would catch it. Task 1 therefore writes that guard instead of a strip: a test that runs each action against a fake `logActivity`, stringifies the whole captured payload and asserts the amount it just passed in does not appear anywhere in it.

## Gating (three layers, all the same capability)

1. **Nav** — one row in `ADMIN_SECTIONS` with `capability: 'finance.view'`, exactly like `/admin/insights`. `finance.view` is `all|none`, never scoped, so the plain `can()` branch of `visibleSections` is right and `navGrantOnly` must **not** be set.
2. **Route** — `loadActor()` then `if (!actor || !can(actor, 'finance.view')) notFound()`, the `insights/page.tsx:62` form, not `requireCapability` (the page needs the actor object anyway and a 404 beats a page of denial panels).
3. **Read** — every new query calls `requireCapability('finance.view')` as the **first line of its body** and returns a `'denied'` state, the rule `queries.ts` sets for money. This matters most for `person_rates`: `schema.ts` records that **nothing in the repo reads that table yet**, and that whoever adds the first reader must add the gate *in the same change*. `listPersonRates` is that first reader.

Unreachable-by-construction is not the same as ungated: the page 404s first, so `'denied'` never renders — it exists so a future caller inherits the refusal instead of a silent read.

## Palette

`src/features/finance/commands.ts` is **new**, and the `finance` entry in `registry.test.ts`'s `NO_COMMANDS` is **deleted in the same change** — check 7 ("a feature that gained a commands.ts is no longer exempt") fails otherwise, which is the allowlist hygiene working as designed. The old reason ("blocked on an unowned capability") stopped being true when `rate-actions.ts` shipped gated on `finance.view`.

One row, not several:

```ts
{ id: 'finance.rates', label: 'Rates and project value', group: 'navigate',
  icon: Coins, href: '/admin/rates',
  keywords: ['rate', 'rates', 'hourly', 'rate card', 'project value', 'contract', 'subscription', 'billing'],
  visible: (ctx) => can(actorFor(ctx), 'finance.view') }
```

`visible` goes through the capability layer, never `role === 'admin'` — the tripwire at the end of `registry.test.ts` exists because that comparison silently hides rows from superadmin. `actorFor(ctx)` is copied from `bugs/commands.ts:41` (empty scope set; `finance.view` has no scoped arm, so nothing is lost). **The keywords contain no amounts and the label names no figure** — ⌘K rows are matched client-side and cached for 30s.

Not a duplicate of a nav row: the palette's admin destinations come from `adminNavItems`, which is `[{ href: '/admin' }]` alone (`nav-items.ts:108`) — `ADMIN_SECTIONS` feeds the *sidebar*, not the palette. Without this row `/admin/rates` is unreachable from ⌘K. `NO_SEARCH`'s `finance` entry stays: no `search-providers.ts` ships, and rates must never enter a workspace-wide index.

## Page zones

Static, painting in the first flush: `PageHeader` ("Rates", "What an hour costs, and what a project is worth.") and the three section headings with their one-line explanations.

1. **Role rate cards** — job role → hourly, from a date. The picker is `JOB_ROLE_GROUPS` (`src/lib/job-roles.ts`), the same free-text suggestion list behind `users.title`, because `rate_cards.role` is matched **by value** against that column and is not a foreign key. An "Other…" free-text arm, capped at `JOB_ROLE_MAX_LENGTH`, keeps a title nobody currently holds priceable.
2. **Person overrides** — person → hourly, from a date. The salary-shaped one. `listActiveUsers()` backs a `SearchSelect`. Deliberately calm: rows alphabetical by name, **never sorted by amount, never totalled, never compared**, no count of who earns more, no chart — `schema.ts` says "no cost-per-person chart, ever", and a sortable amount column is that chart with extra steps.
3. **Project value** — app → contract value and/or monthly subscription. `listAssignableApps()` (`people/queries.ts:624`) backs the picker. One row per app (`project_value_app_idx`), so this section lists apps that have a value on file and the form overwrites the whole row, which is what `setProjectValue` does.

**Controls before data.** The role-rate form needs no server data at all (`JOB_ROLE_GROUPS` is a static import), so it renders outside any Suspense boundary, ahead of its own table. The person and project forms need their picker rows, so each shares one boundary with its table — splitting them would double the query count for a sub-100ms read and drop a table in under a form the admin had already started typing into. Four boundaries total, each with a size-matched `Skeleton` table.

## Section anatomy (identical for all three)

**Form** → `<Label>` + control + helper line, submit `disabled={pending || !valid}` with a `Loader2Icon` spinner inside the button. **In force now** → one highlighted row (or the empty state). **History** → a `<details>` disclosure, "Earlier rates (N)", holding the closed intervals newest first — the `/admin/holidays` "Already passed (N)" pattern.

**Effective-from allows past dates.** `<Input type="date">`, defaulted to today in Asia/Colombo, with **no `min`**, under one sentence that says why it matters:

> Hours are priced by the rate in force on the day they were logged. Backdating this prices history from that day — it never re-prices hours at today's rate.

That is the actual semantics of `rateForPersonOnDay` (`cost.ts:150`) and the reason `setRoleRate` INSERTs rather than UPDATEs. A past date is a legitimate, common entry (the studio is setting up rates now for hours already logged), so it gets an explanation, not a warning ribbon.

**Close, then replace — never one gesture.** `setRoleRate`/`setPersonRate` *refuse* to insert over an interval that is still open (`rate-actions.ts:121`, `:234`); the header says that refusal is deliberate, because two rates in force on one day make cost depend on row order. The UI honours it rather than hiding it: the in-force row carries a **Close** button behind an `AlertDialog` whose body states the consequence — "hours logged from this day on will be priced by whatever rate you set next; every hour before it keeps this one" — and the form's inline error, when the action refuses an overlap, points at that button. No auto-close-and-reopen batch.

**Money input**: bare `<Input type="number" step="0.01" min="0" inputMode="decimal">`, `.toFixed(2)`-free on the client (the action takes a `number` and does its own `toFixed(2)` at the driver boundary — see `rate-actions.ts:127`). No currency-input component is introduced.

**Currency**: a 3-char text input defaulting to `LKR`, uppercased on submit. All three tables carry their own `currency` column and the workspace assumes one currency; `cost.ts` refuses to sum across two. Not a `Select` — the server already validates `/^[A-Z]{3}$/` and an enum here would be a second, drifting source of truth.

**Amounts render as `12,500.00 LKR`** — number in `font-mono tabular-nums`, code as literal text after it. Not `Intl` currency style, which can resolve to a bare symbol; the a11y rule is that the currency is readable as text, not inferred from a glyph.

## States

- **Loading**: four size-matched `Skeleton` tables. Pulse, never a spinner — spinners appear only inside a submit button that is already disabled.
- **Empty**, per section, with the one-line why and a CTA pointing at the form directly above it. Role: "No rate cards yet — every project's cost reads 'no rate set' until a role has one." Person: "No overrides. Everyone is priced by their job role's rate, which is the normal case." Project: "No project values on file — margin cannot be stated without one."
- **Error**: inline `<p role="alert">` under the form, carrying the action's own message verbatim, linked to the offending control by `aria-describedby`. Success is a `toast.success` plus `router.refresh()`. Failures never toast — the message belongs next to the field that caused it.
- **Mobile**: the tables are 4-5 narrow columns and stay tables inside `overflow-x-auto`; unlike the holidays calendar there is no off-screen action column to lose, because Close lives in the in-force block, not in a table row.
- **Reduced motion / theme**: nothing new. Watchdog-calm tokens only, `ring-1` hairlines, no gradients, no glow, no `transition: all`.

**No bilingual wrapper.** `bilingualText` is used by `worklog` components only; no admin page uses it, and this page is admin-only. Person and app names still get `break-words` so a Sinhala name wraps rather than overflowing.

## The six frontend API skills — what applies, and why

- **Optimistic updates + rollback: deliberately NOT used.** This is money with a server-side overlap refusal that the client cannot predict. An optimistic row that rolls back would show a rate that was never set. Every submit waits for the server.
- **Request dedup: yes**, by pending state — `useTransition`'s `isPending` disables the submit button, which is the whole surface a double-submit could enter through.
- **Streaming UI: yes**, as the Suspense split above. That is the only streaming here.
- **SWR / smart polling / preloading: n/a.** Rates change a handful of times a year and are edited by one admin at a time; polling a salary table on an interval is a cost with no benefit and a needless extra read of the most sensitive table in the schema. `router.refresh()` after a write is the whole freshness story.

## Accessibility

Every input has a real `<label for>` (`useId`-derived ids, the holidays pattern). Error text carries `role="alert"` and is linked by `aria-describedby`, alongside the helper text id when both are present. Currency is text, never an icon. The `<details>` history disclosure is native. `AlertDialog` (Base UI) brings its own focus trap and labelled title. Targets stay ≥44px. Amount columns are `text-right font-mono tabular-nums` with a plain `<th scope="col">`.

## Data contracts (pin these — implementers build to them)

**No schema migrations. No change to any existing action's behaviour.**

```ts
// NEW src/features/finance/rate-intervals.ts — zero-dependency, CLIENT-SAFE.
// Types live here, not in rate-queries.ts, so a 'use client' component can
// import them without a value-import of a module that pulls in @/db.
export type RateIntervalRow = {
  id: string
  /** numeric(12,2) as the pg driver returns it: a STRING. Never Number() it for display. */
  hourly: string
  currency: string
  effectiveFrom: string            // YYYY-MM-DD
  effectiveTo: string | null       // null = open = in force
  setByName: string | null         // left join; the setter's account may be gone
}
export type RoleRateRow = RateIntervalRow & { role: string }
export type PersonRateRow = RateIntervalRow & { userId: string; personName: string }
export type ProjectValueRow = {
  appId: string; appName: string; slug: string
  contractValue: string | null           // null = "not stated", never 0
  subscriptionMonthly: string | null
  subscriptionFrom: string | null
  subscriptionTo: string | null
  currency: string
  setByName: string | null
  updatedAt: Date
}

/** Half-open [from, to): in force when from <= today AND (to is null OR to > today). */
export function splitByForce<R extends RateIntervalRow>(
  rows: R[], today: string,
): { inForce: R[]; scheduled: R[]; history: R[] }

/** "12,500.00 LKR" — grouped number then the code as literal text. Takes the driver's string. */
export function formatMoney(value: string | number, currency: string): string

// NEW src/features/finance/rate-queries.ts — requireCapability('finance.view')
// is the FIRST statement of every body; each returns 'denied' rather than throwing,
// the contract queries.ts already gives. Alphabetical/date ordering only; NEVER by amount.
export async function listRoleRates(): Promise<{ state: 'ok'; rows: RoleRateRow[] } | { state: 'denied' }>
export async function listPersonRates(): Promise<{ state: 'ok'; rows: PersonRateRow[] } | { state: 'denied' }>
export async function listProjectValues(): Promise<{ state: 'ok'; rows: ProjectValueRow[] } | { state: 'denied' }>
```

`listPersonRates` is the **first reader `person_rates` has ever had** — its gate ships in the same file, in the same change, per the schema comment. It joins `users` for the name and orders by `users.name` then `effectiveFrom desc`. It returns no aggregate of any kind.

Consumed unchanged, from `rate-actions.ts`: `setRoleRate`, `closeRoleRate`, `setPersonRate`, `closePersonRate`, `setProjectValue`. Existing reads used as-is: `listActiveUsers()` (`people/queries.ts:711`), `listAssignableApps()` (`people/queries.ts:624`), `JOB_ROLE_GROUPS` + `JOB_ROLE_MAX_LENGTH` (`lib/job-roles.ts`).

**Tests required**: `splitByForce` at both boundaries (a row starting today is in force; a row ending today is not — half-open); `formatMoney` on the driver's string form; the amount-leak guard over all five actions; `listPersonRates` refusing a non-`finance.view` actor.

## File plan

**New** — `finance/rate-intervals.ts` (+`.test.ts`), `finance/rate-queries.ts` (+`.test.ts`), `finance/rate-actions.test.ts`, `finance/commands.ts`, `finance/components/rates-role-card.tsx`, `rates-person-card.tsx`, `rates-project-card.tsx`, `rates-interval-table.tsx`, `src/app/(app)/admin/rates/page.tsx`.

**Edit** — `admin/sections.ts` (+`sections.test.ts`), `search/registry/commands.ts`, `search/registry/registry.test.ts` (delete the `finance` NO_COMMANDS entry), `components/shell/nav-items.ts` (one `ADMIN_SECTION_ICONS` line), `README.md`.

**Untouched, load-bearing** — `rate-actions.ts` (verified amount-free; the guard test is added beside it, the file itself is not edited), `finance/cost.ts`, `finance/queries.ts`, `finance/components/project-finance-card.tsx`, `admin/insights/page.tsx`, everything in `src/components/ui/`.

## Deferred (recorded, not forgotten)

- **Editing a rate in place.** Never — `rate-actions.ts` documents why. Not a gap.
- **Atomic close-and-replace.** The two-step is the design, not friction. Revisit only if an admin actually reports it, and then as one action with the overlap check inside it, never as two chained client calls.
- **A separate `finance.write` capability.** `rate-actions.ts` argues against the split; nothing here changes that argument.
- **Multi-currency.** Every table has a `currency` column and `cost.ts` refuses to sum across two. The form defaults to one and does not stop an admin entering another — the maths module, not this page, is where that would have to be solved.
- **Bulk entry / CSV import** of a whole rate card. Real if the studio ever has thirty roles; today it has a handful.
- **A scheduled (future-dated) rate list.** `splitByForce` already returns `scheduled` because the half-open maths produces it for free; v1 renders those rows in the in-force block with a "from <date>" note rather than building a third zone for them.
- **`project_value` history.** The table is one row per app with no interval columns, so "what was it worth last year" is unanswerable by construction. A migration, not a UI change.
