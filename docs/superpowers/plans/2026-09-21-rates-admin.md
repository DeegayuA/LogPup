# Plan — The Rates Desk (/admin/rates)

Spec: `docs/superpowers/specs/2026-09-21-rates-admin-design.md`. 2026-09-21.

Three disjoint owners. **`queries` tasks 1-3 land first** — `components` and `page` build against the Data contracts block in the spec, which is verbatim what task 2 exports. Nobody touches a file outside their own list.

**Off-limits to everyone here** (other agents hold them): `src/features/worklog/**`, `src/app/(app)/admin/absences/**`, `src/features/admin/change-request-*`, `src/features/apps/signoff.ts`, `src/app/(app)/people/[id]/page.tsx`, `src/features/finance/cost.ts`, `src/features/finance/queries.ts`, `src/features/finance/components/project-finance-card.tsx`, `src/app/(app)/admin/insights/page.tsx`.

`src/features/finance/rate-actions.ts` is **not edited**. The brief allowed an edit to strip amounts from its activity-log calls; task 1 verified there is nothing to strip (spec §"The privacy finding"), so the file stays byte-identical and gets a guard test beside it instead.

Verify shape everywhere — output to a file first, exit code second:
`S=<scratchpad>; mkdir -p "$S"; <cmd> > "$S/x.txt" 2>&1; echo "exit: $?"; tail -n 30 "$S/x.txt"`

---

## Owner: `queries`

### Task 1 — amount-leak guard over all five rate actions
- [ ] **New** `src/features/finance/rate-actions.test.ts`. There is no existing test file for these actions (the directory holds only `cost.test.ts`), so this is the first one.
- Mock `@/features/activity/log`, `@/features/auth/actor` (`requireCapability` → a fake actor) and `@/db`. Call each of the five actions with a distinctive amount (`1234.56` for `hourly`, `987654.32` for `contractValue`, `4321.99` for `subscriptionMonthly`).
- Assert, per action: `JSON.stringify(captured)` — the WHOLE `logActivity` argument, `entityLabel` + `detail` + `metadata` together — contains none of `'1234.56'`, `'1234'`, `'987654'`, `'4321'`, and no key named `hourly` / `contractValue` / `subscriptionMonthly`.
- Header comment says WHY: `activity.view` reaches every seat but stakeholder (`capabilities.ts:201`); `finance.view` is admin/superadmin only (`:230`). The test exists to fail the day someone helpfully adds the figure to a payload.
- Verify: `npx vitest run src/features/finance/rate-actions.test.ts` → exit 0.

### Task 2 — the pure interval module
- [ ] **New** `src/features/finance/rate-intervals.ts` — the four row types, `splitByForce`, `formatMoney`, exactly as the spec's Data contracts block declares. **Zero imports.** It is imported by `'use client'` components, so it may not reach `@/db`, `next/headers` or anything server-only.
- [ ] **New** `src/features/finance/rate-intervals.test.ts` — half-open boundaries both ways (a row whose `effectiveFrom === today` is in force; a row whose `effectiveTo === today` is history, not in force), a future `effectiveFrom` lands in `scheduled`, `formatMoney('12500.00', 'LKR') === '12,500.00 LKR'`, and `formatMoney` on a driver string never goes through `Number()` lossily.
- Verify: `npx vitest run src/features/finance/rate-intervals.test.ts` → exit 0.

### Task 3 — the three gated reads
- [ ] **New** `src/features/finance/rate-queries.ts` — `listRoleRates`, `listPersonRates`, `listProjectValues`. `const actor = await requireCapability('finance.view'); if (!actor) return { state: 'denied' }` is the **first statement of every body**, before any row is touched.
  - `listRoleRates`: `rateCards` left-joined to `users` for `setByName`, ordered `role asc, effectiveFrom desc`.
  - `listPersonRates`: joins `users` for `personName`, ordered `users.name asc, effectiveFrom desc`. **This is the first reader `person_rates` has ever had** — put that fact and the gate in the docblock, per the `schema.ts` comment that demands the gate land in the same change. Returns rows only; no sum, no count, no max, no ordering by amount.
  - `listProjectValues`: `projectValue` joined to `liveApps` (`@/db/live` — apps are soft-deleted) for `appName`/`slug`, plus `users` for `setByName`, ordered `appName asc`.
- [ ] **New** `src/features/finance/rate-queries.test.ts` — with `requireCapability` mocked to return null, each of the three returns `{ state: 'denied' }` **and the db mock records zero calls** (the gate is before the read, not after it).
- Header comment says WHY the gate is inline rather than left to the page: the `queries.ts` rule, quoted — "a rate hidden behind a capability but reconstructible from an unguarded total is not hidden".
- Verify: `npx vitest run src/features/finance/rate-queries.test.ts` → exit 0, then `npx tsc --noEmit -p tsconfig.json` → exit 0.

---

## Owner: `components`

All four files are `'use client'`. They import types and helpers from `@/features/finance/rate-intervals` (never from `rate-queries`), call the actions in `@/features/finance/rate-actions` directly, and follow `src/features/worklog/components/org-holidays-card.tsx` for structure: `useId` for label ids, `useTransition` for pending, `toast.success` + `router.refresh()` on success, inline `role="alert"` on failure, `AlertDialog` for the destructive confirm.

### Task 4 — the shared interval table
- [ ] **New** `src/features/finance/components/rates-interval-table.tsx`. Props: `{ rows, subjectLabel, subjectOf, onClose, closing }`. Renders the in-force block (with the Close control behind an `AlertDialog`) and the `<details>` "Earlier rates (N)" history, using `splitByForce`. Amounts via `formatMoney`, `text-right font-mono tabular-nums`, `<th scope="col">`. A `scheduled` row renders inside the in-force block with a "from <date>" note.
- The `AlertDialog` body states the consequence verbatim from the spec: hours from the close date on are priced by whatever is set next; every hour before it keeps this rate.
- Verify: `npx tsc --noEmit -p tsconfig.json` → exit 0.

### Task 5 — role rate card
- [ ] **New** `src/features/finance/components/rates-role-card.tsx`. Props `{ rows: RoleRateRow[]; today: string }`. Role picker from `JOB_ROLE_GROUPS` with an "Other…" free-text arm capped at `JOB_ROLE_MAX_LENGTH`; hourly `<Input type="number" step="0.01" min="0" inputMode="decimal">`; currency `<Input maxLength={3}>` defaulting `LKR`, uppercased on submit; `<Input type="date">` defaulting to `today`, **no `min`**, with the backdating sentence from the spec beneath it. Calls `setRoleRate` / `closeRoleRate`.
- When the action returns the overlap refusal, the inline error must point the admin at the Close control on the in-force row rather than repeating the message alone.
- Empty state: the spec's role copy, CTA pointing at the form above.

### Task 6 — person override card
- [ ] **New** `src/features/finance/components/rates-person-card.tsx`. Props `{ people: ActiveUser[]; rows: PersonRateRow[]; today: string }`. `SearchSelect` for the person, same three fields, `setPersonRate` / `closePersonRate`.
- **The calm rules are load-bearing and go in the file header**: rows alphabetical by name only, never sortable by amount, no total, no count of who earns what, no chart, no comparison copy. A sortable amount column is the cost-per-person chart `schema.ts` forbids, with extra steps.

### Task 7 — project value card
- [ ] **New** `src/features/finance/components/rates-project-card.tsx`. Props `{ apps: AssignableApp[]; rows: ProjectValueRow[] }`. `SearchSelect` for the app; contract value and monthly subscription both optional (blank → `null`, and a header comment saying null means "not stated", never 0); subscription from/to as native date inputs. Sends the **whole row** every time — `setProjectValue` takes no patch — and surfaces its three `.refine` messages inline on the field each one names (`subscriptionFrom`, `subscriptionTo`).
- Picking an app that already has a value prefills the form from its row, so "set" reads as "edit" for the upsert it actually is.
- Verify (tasks 4-7 together): `npx tsc --noEmit -p tsconfig.json` → exit 0, `npx eslint --ignore-pattern '.claude/' --ignore-pattern '.next-e2e/' .` → exit 0.

---

## Owner: `page`

### Task 8 — the route
- [ ] **New** `src/app/(app)/admin/rates/page.tsx`. `loadActor()` then `if (!actor || !can(actor, 'finance.view')) notFound()` — the `insights/page.tsx:62` form, not `requireCapability`. `PageHeader` + the three section headings render statically; **the role-rate form sits outside every Suspense boundary** (it needs no server data), its table inside one; the person and project sections each get one boundary wrapping an async zone that awaits its picker rows and its list together. Four boundaries, four size-matched `Skeleton` tables.
- Each async zone `notFound()`s on a `'denied'` read, matching `ProjectsZone` in `insights/page.tsx`.
- `today` resolved once with `isoDayOf(new Date())` (`@/features/people/iso-day`, Asia/Colombo) and threaded to the cards — never `new Date()` in a client component, which would read the browser's zone.
- Header comment says WHY the page exists: five gated actions with no caller, and every project reading "no rate set".

### Task 9 — nav row + icon
- [ ] **Edit** `src/features/admin/sections.ts` — one row after `/admin/insights`: `{ href: '/admin/rates', label: 'Rates', description: 'What an hour costs, and what a project is worth', capability: 'finance.view' }`. **No `navGrantOnly`** — `finance.view` is `all|none`, so the plain `can()` branch is correct; a comment says so.
- [ ] **Edit** `src/features/admin/sections.test.ts` — add one assertion that `/admin/rates` is absent for `manager` and `auditor` and present for `admin`. (The superadmin test derives its expectation from `ADMIN_SECTIONS`, so it needs no edit.)
- [ ] **Edit** `src/components/shell/nav-items.ts` — one `ADMIN_SECTION_ICONS` entry `'/admin/rates': Coins`. A missing entry degrades to a plain row rather than crashing, but the sidebar should match Insights' vocabulary.
- Verify: `npx vitest run src/features/admin/sections.test.ts` → exit 0.

### Task 10 — ⌘K row, and retiring the exemption
- [ ] **New** `src/features/finance/commands.ts` — the single descriptor from the spec's Palette section. `visible: (ctx) => can(actorFor(ctx), 'finance.view')` with `actorFor` copied from `bugs/commands.ts:41`; **never** a `role === 'admin'` comparison. No import of `@/db`, no `*/queries`, no `next/headers` (registry check 5 scans for exactly those). Keywords carry no figures.
- [ ] **Edit** `src/features/search/registry/commands.ts` — one import line and one spread into `FEATURE_COMMANDS`, alphabetical with its neighbours.
- [ ] **Edit** `src/features/search/registry/registry.test.ts` — **delete** the `finance` entry from `NO_COMMANDS` (check 7 fails otherwise: "a feature that gained a commands.ts is no longer exempt"). Its stated retirement condition — "the moment a /finance route or a cost action exists" — is now met. **Leave the `finance` entry in `NO_SEARCH` exactly as it is**: no search provider ships, and rates must not enter an index anybody can type into.
- Verify: `npx vitest run src/features/search/registry/registry.test.ts` → exit 0 (checks 1, 2, 5, 6 and 7 all touch this change).

### Task 11 — README
- [ ] **Edit** `README.md` — one Features bullet: admin rate cards, per-person overrides and project value, gated on `finance.view`, amounts never logged or searchable.

---

## Final verify (after every task, before the recap)

- [ ] `npx tsc --noEmit -p tsconfig.json` → exit 0
- [ ] `npx eslint --ignore-pattern '.claude/' --ignore-pattern '.next-e2e/' .` → exit 0
- [ ] `npx vitest run` → full suite, exit 0
- [ ] `npm run build` → exit 0 (a new route under `src/app/`)
- [ ] Browser rung on port 3400 (`E2E_TEST_MODE=1 PORT=3400 npm run dev`, dev-login, `/admin/rates`): `take_snapshot` for the labelled inputs and the error linkage, `take_screenshot` for the recap, `list_console_messages` zero errors, `list_network_requests` no 4xx/5xx. **Never port 3000.**
- [ ] Migrations rung: **not run** — no `drizzle/` or `schema.ts` change in this plan. Say so rather than skipping silently.
- [ ] Reviewers, one parallel batch (code, 3+ files, React, DB reads, sensitive data): `ecc:typescript-reviewer` + `ecc:silent-failure-hunter` + `ecc:code-reviewer` + `ecc:react-reviewer` + `ecc:database-reviewer` + `ecc:security-reviewer`, then the `security-review` skill on the final diff.
- [ ] Spot-check by hand before claiming done: grep the diff for `hourly`, `contractValue`, `subscriptionMonthly` outside `rate-queries.ts` / `rate-intervals.ts` / the three cards — any hit in a commands file, a notification, or a `logActivity` payload is the bug this whole spec is shaped around.
