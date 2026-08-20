# Project cost, worth, and effort reporting

**Date:** 2026-08-20
**Status:** Design. **BLOCKED** on per-task hours (`2026-08-20-worklog-hours-design.md`) — see "The dependency that gates everything".
**Owner decisions locked:** blended role rates as the base, with an optional per-person rate where wanted; project worth from contract value AND monthly subscription AND billable-hours-times-rate, accruing automatically where it can.

## The dependency that gates everything

**Today none of this is computable, because the app tracks no hours.** `daily_worklogs` holds a self-scored percentage and a note. There is no rate, salary, cost, contract or revenue column anywhere in the schema — verified against the file, not assumed.

The chain is strictly ordered:

1. **`worklog_entries`** (per-task, per-category minutes) — designed, unbuilt. Without it there are no man-hours, and therefore no cost.
2. **Rates** — this document.
3. **Value** — this document.
4. **Reports and charts** — this document, and worth nothing before 1–3.

Until step 1 ships, the only honest effort figure is **allocated man-days**: allocation % × working days, minus absences and holidays. That is *planned capacity*, not *effort spent*, and the two differ substantially. Any report must label which one it is showing. Presenting allocation as effort is the single most likely way this feature misleads someone.

## Reconcile before reporting

`docs/kpi-inventory.md` §2 documents **thirteen pairs of numbers that already contradict each other** in this codebase — "overdue" means three unrelated things, `FOLLOWUP_STALE_DAYS` is exported twice as 14 and 21, sprint completion is computed two ways, live and historical allocation come from different tables.

Cost reports built on that inherit every contradiction and add money to it. A delivery metric that disagrees with itself starts an argument; a *cost* metric that disagrees with itself starts an escalation. **The §2 reconciliation is a prerequisite, not a nice-to-have**, and it belongs to whoever owns KPI derivation — not to this feature.

## Rates

Two tables, because the sensitivity of the two is completely different.

### `rate_cards` — the base, per job role

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| role | text | the job-role title already carried on `users` |
| hourly | numeric(12,2) | |
| currency | text | one workspace currency; mixing them is a later problem, not a v1 one |
| effective_from | date | |
| effective_to | date nullable | as-of interval, same shape as `assignment_history` |
| set_by, created_at | | |

**Rates are as-of intervals, never a single mutable number.** A rate that is simply edited silently re-prices every hour ever worked — last quarter's finished project changes cost because somebody got a raise. Historical cost must be computed against the rate in force on the day the work happened.

### `person_rates` — the optional override

Same shape, keyed to `user_id`. Present only for people whose rate genuinely differs from their role's.

**This is salary data, and the design treats it as such:**
- Gated by its own capability. The capability matrix is another session's — **ask for one, do not invent one**.
- **Never rendered in any per-person view.** Not the person page, not the directory, not a tooltip.
- **No cost-per-person chart, ever.** A bar chart of cost by person is a salary chart with extra steps. Cost aggregates to project, team, role, or time — never to an individual.
- **The capability must gate the AGGREGATE reads too, not just the rate field.** Suppressing the per-person chart is not sufficient. Anyone who can filter a cost total can narrow it to a single contributor — a project with one person on it, or a date range in which only one person logged — and read their rate off the result by dividing by their hours. **A rate hidden behind a capability but reconstructible from an unguarded total is not hidden.** So the gate belongs on every query that returns money, and a cost figure must refuse to render when its contributor count falls to one rather than quietly resolving to a single person's pay.
- Absent override means the role's rate. That is the normal case and must stay the normal case.

## Worth

All three sources, because they answer different questions and one project can have more than one.

| Source | Shape | Answers |
|---|---|---|
| **Contract value** | one-off amount on the project | "what is this build worth" |
| **Subscription** | monthly amount + start, optional end | "what does this earn while it runs" |
| **Billable hours × rate** | derived from time entries | "what have we earned so far" |

`project_value` carries the first two; the third derives from `worklog_entries` given a **`billable` flag on each entry**. That flag is the one addition this feature makes to the worklog design — defaulted per project (an internal tool is non-billable by default, a client build is billable) so nobody ticks a box per row.

**Subscription accrues automatically**, month by month from its start date — the "auto" the owner asked for. Compute it from the date range at read time; never write periodic rows, or a missed cron silently under-reports revenue.

**Contract value and subscription must never be summed blindly into one "worth" figure** without stating which parts it contains. A fixed-price build and a monthly retainer are not the same kind of money, and one number quietly merging them is exactly the "two numbers under one name" disease `kpi-inventory.md` catalogues.

## Derived figures

- **Man-hours** = Σ `worklog_entries.minutes` ÷ 60 — filterable by project, person, category, billable, date range.
- **Cost** = Σ (minutes ÷ 60 × the rate in force that day). Per project, per sprint, per month.
- **Margin** = value − cost. Shown only where both sides exist; never a margin computed against a missing value.
- **Burn against value** = cost ÷ contract value, for fixed-price work.
- **Effort mix** = share of hours by category (task / meeting / review / support / admin / learning). Often the most actionable chart here, and it needs no money at all.

Each is a pure function over rows, in `src/features/finance/`, unit-tested. **No figure is computed inside a component.**

## Reports and visualizations

**Load the `dataviz` skill before writing any chart code.** This repo has no charting convention yet, and one established badly is expensive to undo.

Surfaces, smallest useful first:

1. **Project cost card** (app overview tab) — hours to date, cost to date, value, margin, burn %. Numbers first, one small trend line.
2. **Effort mix** (project and workspace) — stacked bars by category over time. Needs no rates, so it ships with step 1 rather than waiting for money.
3. **Cost over time** (project) — monthly cost against monthly subscription revenue, for recurring work.
4. **Portfolio view** (admin) — every project's hours, cost, value and margin in one sortable table. At this level the table matters more than any chart.
5. **Capacity vs effort** (admin) — allocated man-days against logged hours, **aggregated to team, never per person**. This is where the allocation-versus-effort distinction is the entire point.

Chart rules: state the window on every figure; show "no data" rather than zero when hours are missing; never a per-person cost chart; every money figure carries its currency; and anything derived from allocation rather than logged hours is labelled an estimate.

## Ownership

KPI derivation belongs to another session by prior agreement — they own what numbers mean, this session owns where they are displayed. **Money is a new domain nobody owns yet.** Before building, agree who owns `src/features/finance/`, and consume the existing definitions (`computeCoverage`, `app-health.ts`, `capacity-compare.ts`, `checkins.ts`) rather than writing second copies. A cost report that disagrees with the coverage rollup about how many days somebody worked is worse than no cost report.

## Out of scope

- Invoicing, payments, tax, multi-currency conversion.
- Payroll, or anything that reads an actual salary figure.
- Per-person cost display in any form.
- Forecasting and projected margin — earn the historical numbers first.

## Testing

- Rate resolution: the rate in force on a given day; an override beating the role rate; a rate change mid-project re-pricing nothing already computed.
- Subscription accrual across month boundaries, mid-month starts, and an ended subscription.
- Margin with a missing value must not render zero.
- Billable default per project, overridable per entry.
- A cost aggregate must not be groupable by individual — assert that at the query layer, not only in the UI.
