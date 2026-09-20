---
name: logpup-development
description: Use when building, reviewing, migrating, or debugging anything in the LogPup repo — before writing a migration, touching speech/TTS, adding UI colors, coordinating with parallel sessions, or deciding delete/privacy/permission behavior.
---

# LogPup Development

Rules that are NOT discoverable from code comments — process, history, and traps that live across sessions. For in-code conventions (soft deletes, event colors), the enforcement tests and file headers already teach them; read those, they are accurate.

## Explore before editing

Use codebase-memory MCP first (`search_graph`, `trace_path`, `get_code_snippet`); run `index_repository` if unindexed. `/graphify` for docs/specs. Read a file before editing it — parallel sessions edit this tree constantly.

## Migrations — the trap list

| Rule | Why |
|---|---|
| **NEVER run `drizzle-kit generate`** until the snapshot chain is repaired | Snapshots are missing for several applied migrations and one has a wrong prevId; generate diffs against the last snapshot and will re-create existing tables WITHOUT `IF NOT EXISTS`. Hand-write SQL + journal entry instead (0031 is the model). Repair = rebuild snapshot JSON only. |
| **Never edit an applied `.sql`** — not even a comment | `db:status` compares sha256(file) to the ledger; an edited applied file reads "never applied" FOREVER. That false signal is why people hand-applied SQL, which caused the ledger drift. |
| Pick the next number from **every worktree's `_journal.json`**, not main's files | Numbers collided 3 ways across branches once (0025/0026 twice, 0019/0020 twice). Sibling worktrees: `../LogPup-sdd-*`. Journal `when` must be strictly increasing. |
| Verify with **`information_schema`**, never the runner's exit code | `npm run db:migrate` has reported success while applying nothing. |
| `--> statement-breakpoint` between statements, **never inside a comment** | The splitter is a plain string split; a marker in a comment truncates the file mid-comment. |
| Dev DB proves nothing about prod | Dev carries hand-applied schema from every branch; prod/preview were never verified. |

## Verification — when a rung is broken, not failing

**`npx vitest run` cannot start in this tree (seen 2026-09-11).** Two separate faults, and the
first hides the second:

1. `@rolldown/binding-win32-x64-msvc` is absent from `node_modules`, so rolldown falls back to a
   wasm binding that is also absent. Repair without touching the lockfile:
   `npm install --no-save --no-package-lock @rolldown/binding-win32-x64-msvc@<rolldown version>`.
2. Then `ERR_REQUIRE_ESM`: `vitest/dist/config.cjs` `require()`s `std-env`, and
   **`package-lock.json` itself pins `std-env` 4.2.0, which is ESM-only.** vitest 4.1.10 needs
   the 3.x line. This is a lockfile-level incompatibility, not a stale install — `npm ci` would
   reproduce it exactly.

Fixing (2) means changing `package-lock.json`, which is usually another session's in-flight
work. Do not do it as a drive-by. Report `vitest BLOCKED: lockfile pins std-env 4.2.0 (ESM) vs
vitest 4.1.10 CJS require` and verify with the rungs that DO work.

**Substitute for the blocked rung, do not skip it.** A `tsx` script in the scratchpad that
imports the changed modules and asserts their pure behaviour exercises the same logic the
colocated tests would, catches import-time breakage, and produces a real exit code:
`npx tsx --tsconfig tsconfig.json "$S/smoke.ts"`. Say in the recap that it stood in for vitest.

**`tsc` reports `TS2304: Cannot find name 'LayoutProps'` in `src/app/layout.tsx` on a tree that
has never been built.** It is a Next-generated global from `.next/types`, not a real error — one
`npm run build` clears it. Do not "fix" layout.tsx.

## Multi-session coordination

- **Never `git stash`** — the stash is shared across all worktrees; a pop has already clobbered another session's entry.
- **Never `git add -A` / `commit -a` / `reset --hard` / `checkout -- .`** — the tree holds other sessions' uncommitted work. Stage explicit paths. `e2e/.auth/state.json` is tracked and carries session tokens — never commit updates to it.
- Git author is identical for every session; **authorship cannot attribute commits**. Coordinate via SendMessage; claim files before editing; never commit while `.git/MERGE_HEAD` exists.
- Peer claims are checked, not trusted — verify file lists against `git status` before acting on them.

## Speech / TTS

- **Never stream Gemini TTS** (`:streamGenerateContent` truncates audio past ~60s at HTTP 200) and **never return whole clips** (a real summary exceeds Vercel's ~4.5MB response ceiling; break-even ≈1,100 chars). Chunked synthesis via `chunk-speech.ts` is the settled design.
- Sinhala shaping: **browser print/render only** — PDF libraries (fontkit/jsPDF) garble complex scripts. The A4 export route (`/print/meetings/[id]`) is the pattern.
- `use-speech.ts` cancellation is a **generation token**; an un-awaited async permission gate returns a truthy Promise — always `await` gates.

## Product decisions already made (don't relitigate)

- Frontend work must evaluate the 6 API skills: dedup, optimistic+rollback, streaming UI, SWR, smart polling, preloading.
- A new feature registers itself with ⌘K — a `commands.ts` and/or `search-providers.ts` in its own directory, wired into `src/features/search/registry/`. `registry.test.ts` fails on a feature that does neither and does not say why, and its message names the fix. Never quiet it by widening the allowlist without a reason.
- Worklog percent = self-scored "of what I planned today"; writes are **self-only** (no admin on-behalf — first-person record). Saturday = half working day; the ONE definition is `src/lib/working-days.ts` — never a private weekday check.
- Per-project roles are free text; `src/lib/project-roles.ts` is the single manager/reviewer pattern; PM manages project+meetings via `managesApp`, leads/architects stay reviewers.
- Identity colors: one system (`event-color.ts`, 8 slots, literal Tailwind classes, `text-background` on solids — dark tokens fail white text). Never add a second hash.
- All day math is Asia/Colombo via `lk-holidays.ts` helpers, never UTC slicing.
- UI is bilingual (Sinhala + English, code-switching is normal — never force-translate; `bilingualText`/`bilingualLead` classes exist for the leading Sinhala needs). Design system: "watchdog calm" — spec in `docs/superpowers/specs/2026-08-10-logpup-design.md`; use the `designing-ui` skill for new pages and `craft` for polish. States always (empty/loading/error), skeletons over spinners, controls render before data (Suspense-split pages — `people/history` is the pattern).
- A `requireCapability(action)` call with a `scoped` grant and NO `{ appId }` resource is a silent refusal — `can()` fails closed by design. 14 such calls hid every PM/lead right behind 'Admins only' until 2026-09-20. When a manager reports 'Not allowed'/'Admins only' on something ROLE_GRANTS says they hold, grep `requireCapability('` for resource-less calls first. Page/nav DOORS use `effectiveGrant(role, employmentType, action) !== 'none'`; the data behind the door stays row-scoped. Sign-off (`apps.change_policy`) is ROUTING after authorisation, never a narrower permission — the matrix answers 'may they', the policy answers 'does it land now' (spec: docs/superpowers/specs/2026-09-20-project-change-policy-design.md).

## Still OPEN — ask the user, don't assume

"Private" for notes/todos/reminders is undecided (owner-only vs admin-visible). One enum, decided once, before any migration. Todos should reuse `tasks` (app-less rows), not a new table.
