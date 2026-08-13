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
- Worklog percent = self-scored "of what I planned today"; writes are **self-only** (no admin on-behalf — first-person record). Saturday = half working day; the ONE definition is `src/lib/working-days.ts` — never a private weekday check.
- Per-project roles are free text; `src/lib/project-roles.ts` is the single manager/reviewer pattern; PM manages project+meetings via `managesApp`, leads/architects stay reviewers.
- Identity colors: one system (`event-color.ts`, 8 slots, literal Tailwind classes, `text-background` on solids — dark tokens fail white text). Never add a second hash.
- All day math is Asia/Colombo via `lk-holidays.ts` helpers, never UTC slicing.
- UI is bilingual (Sinhala + English, code-switching is normal — never force-translate; `bilingualText`/`bilingualLead` classes exist for the leading Sinhala needs). Design system: "watchdog calm" — spec in `docs/superpowers/specs/2026-08-10-logpup-design.md`; use the `designing-ui` skill for new pages and `craft` for polish. States always (empty/loading/error), skeletons over spinners, controls render before data (Suspense-split pages — `people/history` is the pattern).

## Still OPEN — ask the user, don't assume

"Private" for notes/todos/reminders is undecided (owner-only vs admin-visible). One enum, decided once, before any migration. Todos should reuse `tasks` (app-less rows), not a new table.
