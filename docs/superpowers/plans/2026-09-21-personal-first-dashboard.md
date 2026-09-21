# Personal-first dashboard — plan

Spec: `docs/superpowers/specs/2026-09-21-personal-first-dashboard-design.md`

- [x] 1. `zones.ts`: `my-day` first in every `ZONE_ORDER` row; `narrowable` on team,
  coverage, portfolio; `DashboardView`, `parseDashboardView`, `canWiden`; third argument on
  `zoneScope`. Header comment updated.
- [x] 2. `zones.test.ts`: order expectations for the seven seats; `parseDashboardView`;
  `zoneScope` with `personal`; `canWiden`.
- [x] 3. `my-apps.ts`: `getMyAppIds(userId)`, request-cached, assignments-backed.
- [x] 4. `components/dashboard-view-switch.tsx`: two links, `aria-current`, tokens only.
- [x] 5. `components/dashboard-zones.tsx`: `ZoneProps` + `view`/`myAppIds`; the three
  `zoneScope` calls pass them.
- [x] 6. `src/app/(app)/page.tsx`: read `searchParams.view`, load `myAppIds`, render the
  switch when any zone can widen, the no-project note, pass props to every zone.
- [x] 7. Verify: tsc exit 0, lint exit 0, vitest 4852 passed, build exit 0 (2026-09-21 07:21).
  Browser on 3400 BLOCKED: dev login returns CredentialsSignin (the `user_deletions`
  precondition on the shared dev DB) — re-run once the DEV_LOGIN_EMAIL user is restored.
- [ ] 8. Review batch (typescript, silent-failure, code, react, a11y) — findings applied or
  dismissed in the session recap; README bullet once README.md is free.
