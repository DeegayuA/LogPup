# Role-shaped dashboards

**Date:** 2026-08-19
**Status:** Approved (design). Implementation BLOCKED until the seven-role capability layer lands.
**Owner decisions locked:** role-shaped zone sets (not one layout filtered, not user-rearrangeable); design now, build after RBAC lands.

## The problem

`src/app/(app)/page.tsx` composes three fixed zones — MyDay, Team, Portfolio — and gates the last two on a single boolean: `isAdminRole(session.role)`, passed down as `isAdmin` to `TeamZone` and `PortfolioZone`.

With two roles that was defensible. With seven it is not: **manager, editor, member, stakeholder and auditor all collapse into the same "not admin" view.** A stakeholder — who by the capability matrix may not see the people directory or any worklog — lands on a page built around personal tasks they do not have and team capacity they may not read. An auditor, whose whole job is the trail, gets no trail. A manager running three projects sees the same page as a member.

Worse, the gate itself is the pattern `src/features/auth/capabilities.ts` exists to forbid. Its header says it plainly: *"NOT A ROLE LADDER … nothing anywhere may compare two roles. `role >= X` is the bug this table exists to prevent."* `isAdminRole` is that comparison wearing a helper's name.

## The idea

A dashboard is a **list of zones, chosen and ordered by what the viewer can actually do** — never by which role they hold. Roles influence the dashboard only through the capabilities they grant, plus one ordering hint per role.

Two pieces:

1. **A zone registry.** Every zone declares the capability that makes it meaningful and the data it needs. A zone whose capability the actor lacks is not rendered — not rendered empty, not rendered disabled: absent.
2. **A pure composition function.** `composeDashboard(actor) → OrderedZone[]`. Pure, synchronous, unit-tested, no database. The page renders whatever it returns, each zone in its own Suspense boundary as today.

The role's only role is priority: what this person came here to look at first.

## Zone registry

| Zone | Requires | Shows |
|---|---|---|
| `my-day` | always (every actor has a day) | due/overdue tasks, follow-ups owed, today's meetings, unread mentions, worklog nudge |
| `my-work` | `task.edit` at any level | board items assignable to or movable by the actor, grouped by app |
| `team` | `user.view.directory` | capacity heat and active sprints, **restricted to `scopeAppIds`** for a scoped actor |
| `coverage` | `coverage.view` | who is logged, who is absent, gaps — the worklog/absence rollup |
| `portfolio` | `app.view` at `scoped` or `all` | app health strip, sprint progress, roadmap slippage |
| `approvals` | `user.approve` | pending sign-ups and change requests awaiting this actor |
| `trail` | `activity.view` | recent activity across the org, filterable, with the AI catch-up digest |
| `ai-usage` | always (own data) | compact strip: this person's AI usage and key health; the full view stays in Settings |

Zones are **capability-gated, then scope-narrowed**. A manager's `team` zone shows their `scopeAppIds`, not the org. That narrowing already exists in the capability model (`GrantLevel` of `scoped`) and must be honored per zone, or a manager sees data they cannot act on.

### Narrow by grant level, never by scope emptiness

**This is the trap in this design and the one thing an implementer must get right.** `scopeAppIds` is empty for superadmin, admin and auditor — not because they see nothing, but because their grants are `all` and never consult scope. A zone that filters on `scopeAppIds` without first checking the grant level will show an **auditor an empty portfolio and an admin an empty team**: the exact inversion of what those roles are for.

The rule, per zone: read the actor's grant level for the zone's action first.
- `all` → no narrowing. Ignore `scopeAppIds` entirely.
- `scoped` → narrow to `scopeAppIds`; an empty set here genuinely means nothing to show, and the zone renders its empty state.
- `own` → narrow to the actor's own rows.
- `none` → the zone is not in the list at all.

`composeDashboard` therefore returns each zone with the grant level that admitted it, so the zone component never has to re-derive it. `zones.test.ts` must include a case asserting an auditor's `portfolio` and an admin's `team` are UNNARROWED despite an empty `scopeAppIds`.

### Where scope comes from (confirmed against `actor.ts` / `capabilities.ts`)

`loadActor` resolves `scopeAppIds` from three different sources, and zones must not re-derive any of them:
- **manager** — `app_role_history`, open rows only, role in (`pm`, `lead`). Deliberately NOT `managesApp()`, which regex-matches the free-text `assignments.role` string and returns false for a lead.
- **editor, member** — `assignments`.
- **stakeholder** — `app_grants`. A different mechanism, but `loadActor` folds it into the same `scopeAppIds` set, so zones read only that set.
- **superadmin, admin, auditor** — `none`, i.e. empty. See the trap above.

## Per-role ordering

Ordering is a hint attached to the role, not a permission. If a role gains a capability, its zone appears at whatever position the hint gives it, or at the end if unlisted.

| Role | First screen is about | Order |
|---|---|---|
| superadmin, admin | the whole org's exceptions | approvals → team → coverage → portfolio → trail → my-day → ai-usage |
| manager | the projects they run | team (scoped) → coverage → portfolio (scoped) → my-day → my-work → ai-usage |
| editor | the work itself | my-day → my-work → portfolio (scoped) → ai-usage |
| member | their own day | my-day → my-work → ai-usage |
| stakeholder | project outcomes | portfolio (scoped) → my-day (meetings only) → ai-usage |
| auditor | what happened | trail → coverage → portfolio → my-day → ai-usage |

Note `my-day` is present for **every** role including stakeholder — a stakeholder still attends meetings — but its cards are themselves capability-filtered, so a stakeholder's `my-day` is meetings and mentions with no worklog or task content. This is why zones must filter internally as well as being gated: `my-day` is always shown, and would otherwise leak.

## Architecture

- `src/features/dashboard/zones.ts` — the registry: zone ids, required capability, and the per-role order table. Pure data plus `composeDashboard(actor): ZoneId[]`. Unit-tested.
- `src/features/dashboard/components/dashboard-zones.tsx` — existing file, refactored: `TeamZone` and `PortfolioZone` lose their `isAdmin` prop and take the actor (for scope); new zone components for `coverage`, `approvals`, `trail`, `ai-usage`.
- `src/app/(app)/page.tsx` — becomes a loop over `composeDashboard(actor)`, rendering each zone in its own `<Suspense>` with its existing skeleton. The greeting and the nudges stay above the loop.
- `isAdminRole` is removed from this page. If it has no other callers afterwards, delete it.

Each zone keeps its own Suspense boundary, so the page still streams — controls before data, per the design system.

## What this does NOT do

- No user-rearrangeable layout, no layout-prefs table. Considered and rejected for now: it needs drag-to-reorder UI and persistence, and role-shaped defaults capture most of the value.
- No new data sources. Every zone renders from existing queries; `coverage` depends on the absences/coverage work in flight elsewhere and is the one zone that may ship later than the rest.
- No change to the capability matrix. If a zone needs an action that does not exist, that action is added to `capabilities.ts` **by whoever owns that file**, not by this work.

## Dependencies and sequencing

Blocked on the seven-role capability layer being committed: `loadActor`, `Actor` with `scopeAppIds`, and `can()`. Another session owns `capabilities.ts`, `actor.ts` and the migration widening `user_role`. This work starts only once those are on `main` and the tree typechecks — building the composition layer against a moving matrix would mean rewriting it.

Coordination status:
- **Action spellings — CONFIRMED** against the file on disk: `coverage.view`, `user.approve`, `task.edit`, `app.view`, `user.view.directory` are all correct as written.
- **`scopeAppIds` — CONFIRMED** for manager, editor and stakeholder, from three different sources; see "Where scope comes from" above.
- **`trail` — RESOLVED. Gates on `activity.view`.** The matrix now models the trail as two distinct questions, and this zone is the first of them:
  - `activity.view` — the shared memory of what changed (`/activity`). Granted `all` to superadmin, admin, manager, editor, member and auditor; **`none` to stakeholder**, deliberately, so a client seat cannot sit and watch the studio work.
  - `audit.view` — the compliance surface: the same table unfiltered, including trashed rows and self-approval metadata. `all` for superadmin, admin, auditor; `scoped` for manager; `none` for editor, member, stakeholder.

  This zone renders the recent-activity feed and the catch-up digest, which is `activity.view` content, so that is its gate. `audit.view` belongs to a standalone compliance surface, not to a dashboard zone — if one is ever wanted here it is a SEPARATE zone, not this one widened.

  **Implementation note for any future `audit.view` use:** a manager holds it at `scoped`, so the resource's `appId` must be passed to `can()` or the check fails closed.

  **Product change to surface, not to bury:** gating `/activity` on `activity.view` removes it from stakeholders, who can reach it today. That is a deliberate decision by the capabilities owner, but it is a visible capability removal and must be presented as one — in release notes or an admin-facing note — rather than landing silently as plumbing. This design does not make that change; it inherits it, and `trail` is already absent from the stakeholder ordering below.

## Division of ownership with the KPI work

A parallel effort is adding system-wide KPIs (delivery, people load and coverage, meeting follow-through, cross-project health). Agreed split, so that neither side owns both halves:

- **This work owns composition**: the zone registry, `composeDashboard(actor)`, which zones exist, who sees them, and how each narrows.
- **The KPI work owns derivation**: one module composing the existing definitions (`app-health.ts`, `capacity-compare.ts`, `checkins.ts`, `plan-read.ts`, `computeCoverage`), plus any standalone non-dashboard surfaces.
- Zones render those derivations. The KPI work adds no dashboard section of its own.

The point: one answer to "what does at-risk mean", one answer to "who sees what", and different owners for each.

## Testing

- `zones.test.ts`: composition per role (all seven); a missing capability removes its zone; scope narrowing is requested wherever the table says `scoped`; an unknown or newly added role fails CLOSED to `my-day` only, never to the admin ordering.
- No snapshot tests of the page — they would ossify the ordering table, which is meant to be edited.
- Manual pass: sign in as each role and confirm the first screen matches the "first screen is about" column.
