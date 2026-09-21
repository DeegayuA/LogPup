# Personal-first dashboard — design

Date: 2026-09-21 · Predecessor: `2026-08-19-role-dashboards-design.md` (zone registry, per-role order)
Scope: `src/features/dashboard/zones.ts`, `my-apps.ts`, `components/dashboard-zones.tsx`,
`components/dashboard-view-switch.tsx`, `src/app/(app)/page.tsx`.
Design system: "watchdog calm" (`2026-08-10-logpup-design.md`) — tokens only, states always.

## Problem

The 08-19 design made the dashboard role-shaped: zones are admitted by capability and ordered
by a per-role hint. Two things follow that the owner's brief ("the dashboard is for each user;
redesign it for each and everyone") calls wrong:

1. Admins, managers, auditors and stakeholders open on org-wide zones; their own day sits
   fourth to sixth. A superadmin's first screen is somebody else's approval queue.
2. Every zone reads the whole studio for an `all` grant, so two admins see the same page,
   and nothing on it says which projects are *theirs*.

## Decisions (each recorded as an assumption; the brief named none of them)

1. **Personal-first order.** `my-day` is the first zone for every seat; `my-work` follows it
   wherever it is admitted. The remainder of each role's order is unchanged.
2. **"My projects" by default.** The three zones that narrow by app — team, coverage,
   portfolio — open on the viewer's own projects even when the grant is `all`. "Own
   projects" means the viewer's `assignments` rows: the same source a member's scope comes
   from. A page-level switch, **My projects / Whole studio**, widens. State lives in the URL
   (`/?view=all`); nothing is stored.
3. **Honest fallback.** A viewer with an `all` grant and no assignments sees the whole studio
   and a one-line note saying why. A narrowed zone that is empty uses its existing empty
   state. Scoped and own grants never widen: the capability matrix decides reach, the switch
   only narrows a wide grant.
4. **The 08-19 lock stands.** No hide, no drag, no per-user layout storage, no migration.
5. **Approvals and trail stay org-wide** (a queue and a shared feed have no personal slice
   worth a switch today). `my-day` and `ai-usage` are already personal.

## Data contracts

- `DashboardView = 'mine' | 'all'`. `parseDashboardView(raw)` returns `'all'` only for the
  literal string `'all'`; absent, arrays and any other value are `'mine'`.
- `ZoneDefinition.narrowable?: true` marks team, coverage and portfolio. `canWiden(zone)` is
  `zone.narrowable === true && zone.grant === 'all'`.
- `zoneScope(grant, actor, personal?)` where `personal = { view, myAppIds }`:
  `all` + `mine` + `myAppIds.size > 0` → `{ kind: 'apps', appIds: myAppIds }`; every other
  combination is exactly the pre-existing answer. The optional third argument keeps every
  existing caller and test valid.
- `getMyAppIds(userId)` → `ReadonlySet<string>` from `select app_id from assignments where
  user_id = $1`, request-cached. NOT `actor.scopeAppIds`, which `loadActor` leaves empty for
  superadmin, admin and auditor on purpose.
- `ZoneProps` gains `view: DashboardView` and `myAppIds: ReadonlySet<string>`; the page
  computes both once and passes them to every zone.
- URL: `/` = mine, `/?view=all` = whole studio.

## States

| Situation | What renders |
|---|---|
| Some rendered zone can widen | switch in the page header; active choice carries `aria-current="page"` |
| No rendered zone can widen (scoped/own seats) | no switch — there is nothing to switch |
| `mine`, `all` grant, no assignments | zones show the studio; note under the header: "You are not on a project yet, so this shows the whole studio." |
| `mine`, narrowed zone empty | that zone's existing empty state |

## Testing

- `zones.test.ts`: the new order for every seat; `parseDashboardView`; `zoneScope` with
  `personal` for all/scoped/own; empty `myAppIds` keeps `all`; `canWiden` by zone and grant.
- Browser (port 3400, dev login): admin dashboard on `/` and `/?view=all`; a11y snapshot has
  the nav with the current link; zero console errors.

## Deferred

- Trail narrowed to my projects — needs a filter on `listRecentActivity`; the 08-12 trail
  design says "everyone sees everything".
- Portfolio for an `own` grant — the 08-19 `minGrant: 'scoped'` decision.
- Remembering the switch per person — needs preference storage; the 08-19 lock.
- A ⌘K command for the switch — the registry files are held by another session today.
- README Features bullet — README.md is held by another session today; text is in the recap.
