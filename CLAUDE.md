@AGENTS.md

# LogPup — how Claude works in this repo

Loaded every session. `AGENTS.md` (imported above) is rewritten to Next's canonical block by `next dev` whenever it differs; rules never go there — they go here or in `.claude/skills/logpup-development/SKILL.md`.

**Every prompt gets the full pipeline. Size is not an exemption.** "Check X", "change one word", "is this right?" each run: skill load → graph/MCP lookup → plan line → change → tsc always, lint + vitest when code changed, exit lines quoted → reviewer subagents → docs/memory/graph touch → recap. Scale the plan down, never the pipeline. The user runs Claude unattended and a parallel session on the same tree; a skipped check hands them a red tree.

Act on the recommended default and record it under `Assumed:` in the recap. Ask only for the cases under "Stop and ask ONLY when".

## The mandatory pipeline

### 1. Session start (before the first task tool call)
- Invoke the `logpup-development` skill (migration traps, multi-session git rules, speech/TTS, product decisions, the OPEN list). It does not auto-load.
- `MEMORY.md` is in context; open the memory entries the task touches (`~/.claude/projects/-Users-deeghayuadhikari-Documents-GitHub-LogPup/memory/`).
- `git status --short` — any dirty path you did not write this session is the parallel session's in-flight work (exception: `e2e/.auth/state.json`, rewritten by your own `npm run e2e`; never stage it). Never stage, stash, revert, or reformat their paths. If the task's own target is dirty: `ListAgents`; if another local session is listed, `SendMessage` it `taking <path> for <task>` (do not wait for a reply); re-read the file, make the change on top of their working-tree content keeping every line of theirs, and record `Assumed: edited <path> over the other session's uncommitted changes`.
- `git rev-parse --short=8 HEAD` vs `Built from commit` in `graphify-out/GRAPH_REPORT.md` (8 hex chars each); if they differ, `graphify update .` (no API cost, a minute or two, Bash `run_in_background`) and query only after it finishes. See "Document, remember, hand off" for what it dirties.

### 2. Understand
Stop at the first source that answers; the order is fixed:
1. codebase-memory MCP if connected: `search_graph` → `trace_path` → `get_code_snippet` (`index_repository` first if unindexed).
2. `graphify query "<question>"` (BFS); `--dfs` to trace one path; `graphify path "A" "B"`; `graphify explain "<Node>"`.
3. `grep -rn` / `sed -n` last, for exact strings only.
- Any library API → context7 `resolve-library-id` then `query-docs`; never from memory. Next.js docs per AGENTS.md.

### 3. Think + plan
| Task size | "Plan" means |
|---|---|
| ≤2 files, obvious scope | One line in the reply: `Plan: <change> in <path>. Assumes: <default>.` Then act. |
| Bug / unexpected behaviour | `superpowers:systematic-debugging` (or `mattpocock-skills:diagnosing-bugs`): reproduce, then fix. |
| Feature, 3+ files, new behaviour | `superpowers:brainstorming` → `docs/superpowers/specs/<YYYY-MM-DD>-<slug>-design.md` → `superpowers:writing-plans` → `docs/superpowers/plans/<YYYY-MM-DD>-<slug>.md` → `superpowers:subagent-driven-development`. |
- Brainstorming asks questions one at a time. Answer them yourself from the existing specs, memory, and the product decisions in `logpup-development`, record each answer as `Assumed:`, and put a real question to the user only for a case under "Stop and ask ONLY when".
- Parallel subagents: when the question spans 2+ areas (action + UI + schema), dispatch one `Explore` (or `caveman:cavecrew-investigator`) per area plus one `Plan` in the same message; merge before writing. `superpowers:dispatching-parallel-agents` governs the fan-out.
- Workflow tool: when the session says ultracode is on, every task of 3+ files or with a plan file runs as a Workflow script (`workflow-authoring` skill for the API). ≤2-file edits run inline — they still get the full verify and review stages.
- Judge panel: 2+ credible designs and no obvious winner → the `ecc:council` skill (it spawns Skeptic/Pragmatist/Critic subagents given only the question), or for architecture the `ecc:architect` + `ecc:code-architect` subagents in parallel, each returning a scored pick. You choose and record it in the spec.

### 4. Build
- `superpowers:test-driven-development`: failing colocated `*.test.ts` first, then the change; every bug fix gets a regression test.
- Domain skill per surface: pages/UI → `designing-ui` + `craft`; React → `ecc:react-patterns`, `ecc:react-performance`; actions/DB → `ecc:postgres-patterns`, `ecc:backend-patterns`, `ecc:error-handling`; migrations → `ecc:database-migrations` after the `logpup-development` trap list; auth/input/secrets → `ecc:security-review` (checklist while building); AI → `claude-api`, `vercel:ai-sdk`, `ai-inputs`, `ai-governors`; Next specifics → `vercel:nextjs`, `vercel:react-best-practices`.
- Subagents build on disjoint paths in the SAME working tree — no `git worktree`, no isolation branches (user rule). Give each an explicit file list: `caveman:cavecrew-builder` for ≤2 files, `general-purpose` for more.
- Any frontend touch: evaluate the 6 API skills (`logpup-development` §Product decisions; memory `frontend-api-skills-rule`) and name which apply, and why, in the recap.
- Any new feature registers with ⌘K — rule and fix in `logpup-development` §Product decisions; `registry.test.ts` enforces it. Fix the feature, never widen the allowlist.

### 5. Verify
Run the **Verification ladder** for the change class. No "passes" claim without an `exit: 0` captured to a file first; `superpowers:verification-before-completion` before any success word.

### 6. Review (after EVERY change, in parallel, before the recap) — the single definition of the reviewer batch
| Change | Reviewers (one message, dispatched together) |
|---|---|
| Code, 3+ files | `ecc:typescript-reviewer` + `ecc:silent-failure-hunter` + `ecc:code-reviewer` |
| Code, ≤2 files (one word included) | `caveman:cavecrew-reviewer` + `ecc:typescript-reviewer` |
| Docs / config only | `caveman:cavecrew-reviewer` |
| + React / UI | `ecc:react-reviewer`; a11y-relevant → `ecc:a11y-architect` |
| + schema, migrations, queries | `ecc:database-reviewer` |
| + auth, user input, secrets, env | `ecc:security-reviewer`, then the `security-review` skill on the final diff |
Fix every finding you agree with, re-run the affected verify rung, and list dismissed findings with the reason. `superpowers:receiving-code-review` governs the loop.

### 7. Document + remember
Per **Document, remember, hand off**: update the spec/plan you worked from, `README.md` Features for user-visible changes, refresh the graph, and add a memory entry (file + `MEMORY.md` index line) for any new trap or user rule.

### 8. Recap (always this block, terse)
```
Did: <what changed, paths>
Assumed: <every default chosen>
Verified: tsc exit 0 (hh:mm) · lint exit 0 · vitest N passed · build exit 0 · e2e <passed | BLOCKED: user_deletions precondition> · browser <screenshot path | n/a>
Reviewed: <agents> → <N fixed / M dismissed: reason>
Docs/memory/graph: <files touched, incl. unstaged graphify-out paths | none>
Open: <irreversible or OPEN-rule items only, with the exact command or SQL the user must run>
```

### Minimum for a trivial prompt ("check X", "change one word")
| Stage | Still happens |
|---|---|
| Start | `logpup-development` invoked, memory entries opened, `git status --short` checked, graph freshness checked |
| Understand | one `search_graph` or `graphify query`; target file read in full |
| Plan | one plan line with one stated assumption |
| Build | the edit (`caveman:cavecrew-builder` if delegated); a test if behaviour changed |
| Verify | the ladder's rungs for the change class — never less than tsc; a one-word code change still gets lint + full vitest |
| Review | the §6 row for the change |
| Document | header comment / README / memory if any became stale, else `none`; `graphify update .` if code changed |
| Recap | the full block above |

### Stop and ask ONLY when
- Destructive or irreversible: `reset --hard`, dropping a column/table, force-publishing an artifact. (Never, not ask: reverting or overwriting the other session's uncommitted changes — edit on top per §1; editing an applied migration `.sql` — write a new numbered one; `git push` — the user's.)
- The task lands on an item under "Still OPEN" in `logpup-development`.
- It needs a DB write Claude cannot perform (`npm run db:migrate`, `npm run db:status`, data repairs, restoring the e2e user): do everything else EXCEPT the `src/db/schema.ts` declaration — a declared column whose migration is unapplied breaks every read of that table for every session (memory `logpup-schema-declaration-is-live`). Write the SQL + `_journal.json` entry, hold the `schema.ts` change, and hand over the exact command or SQL — land both or land neither.

## Verification ladder

Output goes to a file first, the exit code second, filtering third — a pipe reports the LAST command's status and has reported "clean" over a real `TS2339` here. Shell state does not survive between Bash calls, so every verify command starts with `S=<the scratchpad directory named in the system prompt>; mkdir -p "$S";` — never a bare `$S`, never `/tmp`.

```bash
S=<scratchpad dir>; mkdir -p "$S"; npx tsc --noEmit -p tsconfig.json > "$S/tsc.txt" 2>&1; echo "tsc exit: $?"; tail -n 30 "$S/tsc.txt"
```

| Rung | Command (same `> file; echo "exit: $?"` shape) | Takes | Run when |
|---|---|---|---|
| tsc | `npx tsc --noEmit -p tsconfig.json` | 2–5 min | **every task**, read-only checks and docs-only included — it is the shared tree's health check; start it in the background after the LAST edit and re-run after review fixes |
| lint | `npx eslint --ignore-pattern '.claude/' --ignore-pattern '.next-e2e/' .` | ~1 min | any code change; pre-existing warnings in files you did not touch stay (report them, no drive-by fixes) |
| vitest | `npx vitest run` (one file while iterating: `npx vitest run src/path/x.test.ts`) | ~40 s · 264 files · ~4,600 tests (2026-09-06) | any code or docs change; full run before the recap |
| build | `npm run build` | several min | anything under `src/app/`, `src/proxy.ts`, `next.config.ts`, `package.json`, `src/db/schema.ts`, env handling. `prebuild` rewrites the tracked `src/lib/changelog.data.json` from git log — never stage that file |
| migrations | `npm run db:drift` · an `information_schema` query (`node --env-file-if-exists=.env.local -e` with `pg`/Neon) | seconds | any `drizzle/` or `schema.ts` change. `db:generate` is BROKEN; `db:status` and `db:migrate` are user-run — hand them over; the trap list is in `logpup-development` |
| e2e | `npm run e2e` (one spec: `npx playwright test e2e/smoke.spec.ts`) | 3–10 min | any UI flow, sign-in, navigation, soft-delete, meetings; specs live in `e2e/*.spec.ts` |
| browser | chrome-devtools MCP against a server you started (below) | minutes | any visual or interactive change; a new page also gets `lighthouse_audit` |

Change class → rungs: read-only check → tsc. Docs/config only → tsc + vitest. Any code change, one word included → tsc, lint, vitest. UI component → + browser; a flow → + e2e. Server action / query → + `security-review` when it reads input, auth, or secrets. Schema / migration → + migrations, build. Auth / proxy / env → + build, e2e smoke, `security-review`.

### Playwright rules
- Port **3400**, dist `.next-e2e`, `E2E_TEST_MODE=1`, `AUTH_URL` overridden — all set by `playwright.config.ts`, which starts its own server (`reuseExistingServer: false`). Needs `.env.local` (DB URL, `DEV_LOGIN_EMAIL`).
- **Never touch port 3000.** That is the human's dev server: never start, restart, or kill it; never run `npm run dev` without `PORT=3400 E2E_TEST_MODE=1`.
- Precondition on the shared dev DB: the `DEV_LOGIN_EMAIL` user must have no open `user_deletions` row (open = `restored_at IS NULL`). If `auth.setup` fails (no "Dev login" button, `CredentialsSignin`, stuck on `/sign-in`), report `e2e BLOCKED: user_deletions precondition` and continue, handing over exactly:
  ```sql
  UPDATE user_deletions SET restored_at = now()
   WHERE restored_at IS NULL
     AND user_id = (SELECT id FROM users WHERE email = '<DEV_LOGIN_EMAIL>');
  ```
  (the same write the admin restore in `src/features/admin/trash-actions.ts` makes; `restored_by` may stay NULL). Never write "e2e passed" without an `exit: 0` from a run that reached the specs.
- Failures leave traces and screenshots in `test-results/` (`retain-on-failure`). Do not run `npm run e2e` while your own `E2E_TEST_MODE=1` dev server is up — same `.next-e2e` lock.

### Browser check (chrome-devtools MCP)
```bash
S=<scratchpad dir>; mkdir -p "$S"; E2E_TEST_MODE=1 PORT=3400 npm run dev > "$S/dev.txt" 2>&1   # Bash, run_in_background: own distDir + lock, dev-login button on /sign-in, AGENTS.md rewrite disabled
S=<scratchpad dir>; until grep -qE 'Ready in|Error|error|failed|EADDRINUSE' "$S/dev.txt"; do sleep 0.5; done; tail -n 5 "$S/dev.txt"   # Bash, run_in_background (foreground sleep is blocked)
```
`predev` runs the migration and drift checks first; anything but `Ready in` is a DB precondition — report it, skip the browser rung, continue. Then `navigate_page` to `http://localhost:3400/sign-in`, click the `Dev login • <email>` button, open the changed page, and collect: `take_snapshot` (a11y tree — the assertions), `take_screenshot` (path goes in the recap), `list_console_messages` (zero errors), `list_network_requests` (no 4xx/5xx). Stop only the server you started: `lsof -ti tcp:3400 | xargs kill`. Tool prefix: `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`.

### Before saying "done", "fixed", "passes"
`superpowers:verification-before-completion`. Quote the exit line and its time in the recap. A pass older than the last edit — yours or the other session's (`git status --short` changes under you) — is not evidence; re-run. Red is reported as red with the first failing line; never `.skip` a test, widen an allowlist, add `@ts-ignore`, or delete a check to get green. Red caused by the other session's dirty files: report file and line, do not edit their file.

When red: `ecc:build-error-resolver` (`ecc:react-build-resolver` for JSX, hydration, or RSC-boundary errors) with a minimal diff, or `superpowers:systematic-debugging` when the cause is unclear; then re-run the rung with the exit line.

## Document, remember, hand off

Every change leaves the written record as current as the code. Nothing here is optional because the change was small.

| Change | Record to update |
|---|---|
| Feature or new behaviour | Spec `docs/superpowers/specs/<YYYY-MM-DD>-<slug>-design.md` (keep a **Data contracts** and a **Deferred** section like `2026-09-01-meetings-docket-design.md`), plan `docs/superpowers/plans/<YYYY-MM-DD>-<slug>.md`; tick the plan's tasks as they land |
| Any file with a header comment | Keep the header true. Headers here say WHY (the trap, the ceiling, the decision), never what the code obviously does; delete a header claim the change makes false |
| User-visible change | `README.md` Features / Stack bullets |
| Something an audit or inventory in `docs/*.md` lists (KPIs, meeting intel, self-teaching) | that file's row |
| A new cross-session trap, decision, or process rule | `.claude/skills/logpup-development/SKILL.md` (tracked, shared with every session) |
| Code changed | `graphify update .` — rewrites tracked files under `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json`, `cache/stat-index.json`, a dated snapshot dir), adds untracked `cache/ast/**` blobs, and on graphs over 5,000 nodes deletes tracked `graph.html` — restore that one (`git show HEAD:graphify-out/graph.html > graphify-out/graph.html`), never stage the deletion. Leave the rest unstaged and list the paths under `Docs/memory/graph:` in the recap; they enter a commit only when the user asks, under the Commits rules. `index_repository` too if the codebase-memory MCP is connected |
| Anything about the user, their corrections, or a decision not derivable from the code | Memory file (below) |

### Memory
`~/.claude/projects/-Users-deeghayuadhikari-Documents-GitHub-LogPup/memory/` — one fact per file, frontmatter `name` / `description` / `metadata.type` (`user` | `feedback` | `project` | `reference`), body with **Why:** and **How to apply:**, `[[links]]` to related entries, and one index line in `MEMORY.md`. Update an existing file rather than duplicating; delete one that turned out wrong. Never store what the repo already records.

### Commits (only when the user asks — they commit from VS Code themselves)
- Subjects become the in-app version history via `scripts/generate-changelog.mjs`: `<type>: <human-readable subject>` with `type` ∈ feat/fix/docs/refactor/perf/test/chore/style/build/ci. Never `.`.
- `git add <path1> <path2>` then `git commit --only <path1> <path2> -F- <<'EOF'` — `--only` is mandatory (one index shared by every session; `git add` → `commit` is not atomic and once swept 73 files) and still not sufficient: `git diff <path>` each path and commit only what you wrote this task. Git hygiene otherwise per `logpup-development` §Multi-session coordination (explicit paths only; no stash / add -A / commit -a / reset --hard / checkout -- . / clean; nothing while `.git/MERGE_HEAD` exists).
- Never stage `e2e/.auth/state.json`, `.env*`, `src/lib/changelog.data.json` (build artefact), or a path you did not write this task. No `Co-authored-by` or attribution lines.
- The other session's working-tree changes are never discarded or reverted; verify they still pass, but do not stage or commit them — they are theirs to commit. Anything auth- or credential-shaped in them gets `security-review` and is reported, not adopted.
- `git push` and pull requests are the user's (no `gh` CLI here; the GitHub MCP is failing).

## Routing table: skills, subagents, MCP

Skills load through the Skill tool, subagents through the Agent tool (`subagent_type`), MCP through the tool prefixes below. Rows marked **always** run on every prompt, including "check X" and one-word edits. An unavailable server is named in the recap and worked around; it never stalls the task.

### Skills: when → invoke

| When | Invoke |
|---|---|
| Session start, before reading any file | `logpup-development` — **always**. Migration traps, multi-session git, TTS, product rules, the OPEN questions. Load it; do not paraphrase it. Then `ecc:resume-session` if there is a saved session. |
| "How does X work", "what calls Y", "where is Z", blast radius of a change | `codebase-memory` (`search_graph`, `trace_path`, `get_code_snippet`) when the MCP is connected; otherwise `graphify` → `graphify query "<question>"` — **always** before grep. |
| Unfamiliar area, or before writing anything that might already exist | `ecc:codebase-onboarding`, `ecc:code-tour`, `ecc:search-first`, `ecc:documentation-lookup` |
| Feature or new behaviour | `superpowers:brainstorming` (self-answered per pipeline §3) → `superpowers:writing-plans` → `docs/superpowers/plans/<date>-<slug>.md` (spec: `docs/superpowers/specs/<date>-<slug>-design.md`) |
| Executing a written plan | `superpowers:executing-plans`; independent tasks in-session → `superpowers:subagent-driven-development` + `superpowers:dispatching-parallel-agents` |
| Writing or changing code | `superpowers:test-driven-development` (`mattpocock-skills:tdd`, `ecc:tdd-workflow` for the vitest specifics) |
| Bug, failing test, "it did something odd" | `superpowers:systematic-debugging` + `mattpocock-skills:diagnosing-bugs` before proposing any fix |
| New type, entity, or module boundary | `mattpocock-skills:domain-modeling`, `mattpocock-skills:codebase-design` |
| Before claiming done / fixed / passing | `superpowers:verification-before-completion` — **always** |
| After every change | the reviewer batch in pipeline §6; `superpowers:requesting-code-review` → apply results via `superpowers:receiving-code-review`; `simplify` for cleanup passes; `security-review` (diff review) when the diff touches auth, input, secrets, or a route |
| Merge or rebase conflict | `mattpocock-skills:resolving-merge-conflicts` |
| See the change in the running app | `run` (never port 3000 — use the browser check in the ladder); recurring checks → `loop`; Workflow scripts under ultracode → `workflow-authoring` |
| New page, dashboard, dialog, component | `designing-ui` (reads the watchdog-calm spec) → build → `craft` before review; direction/typography → `frontend-design:frontend-design`; feel → `ecc:make-interfaces-feel-better` |
| Any `.tsx` edit | `ecc:react-patterns`, `ecc:react-performance`, `ecc:frontend-patterns`; tests → `ecc:react-testing`; the 6 API skills check (pipeline §4) — **always** for frontend |
| Accessibility | `accessibility` (design), `ecc:frontend-a11y` (code), `chrome-devtools-mcp:a11y-debugging` (live page) |
| Animation, transitions | `ecc:motion-foundations`, `ecc:motion-patterns` |
| Chart, sparkline, KPI tile, dashboard | `dataviz` before the first line of chart code |
| Tokens, design system, UX critique | `ecc:design-system`; `general-design-review`, `ux-heuristics-review` |
| SQL, Drizzle query, index | `ecc:postgres-patterns` |
| Schema or migration | `ecc:database-migrations` after the `logpup-development` trap list; verify per the ladder's migrations rung |
| Server action, route handler, API shape | `ecc:backend-patterns`, `ecc:api-design`, `ecc:error-handling`; auth/input/secrets/endpoint → `ecc:security-review` (checklist) |
| Style, verification pass, e2e, manual QA, pre-ship, git | `ecc:coding-standards`, `ecc:verification-loop`, `ecc:e2e-testing`, `ecc:browser-qa`, `ecc:production-audit`, `ecc:git-workflow` |
| Anything under `src/app/`, RSC, server actions, caching | `vercel:nextjs` — **always** for App Router work; `vercel:react-best-practices`; `'use cache'` → `vercel:next-cache-components`; bundler → `vercel:turbopack`, `ecc:nextjs-turbopack` |
| Runtime, deploy, env, CDN | `vercel:vercel-functions`, `vercel:deployments-cicd`, `vercel:env-vars`, `vercel:cdn-caching` — guidance only; the Vercel CLI is not installed |
| Anything Anthropic-named, or LLM-shaped with no provider stated | `claude-api` — **always**, before opening the file. LogPup's shipped AI is Gemini via raw `fetch` in `src/features/gemini/client.ts` (no `ai`/`@ai-sdk` dependency); the skill's own skip rule applies only when Gemini is explicitly the provider in hand |
| Adopting the Vercel AI SDK or AI Gateway | `vercel:ai-sdk`, `vercel:ai-gateway` (neither is a dependency today) |
| AI UX | prompt surface → `ai-inputs`; confirmation/risk/oversight → `ai-governors`; disclosure/consent/labels → `ai-trust-builders`; name/icon/persona → `ai-identifiers`; orientation inside AI flows → `ai-wayfinders` |
| Writing or fixing a prompt; registering an AI feature | `prompt-master`, `ecc:prompt-optimizer`; a new feature needs `AI_FEATURES` (`src/features/gemini/ai-features.ts`) and `DEFAULT_CHAIN` (`src/features/gemini/model-choice.ts`) in the same commit |
| CLAUDE.md | `claude-md-management:claude-md-improver`, `claude-md-management:revise-claude-md` |
| Docs after a change | `ecc:update-docs` — spec/plan under `docs/superpowers/`, README Features list; `ecc:update-codemaps` only once a CODEMAPS dir exists (none today) |
| "From now on / whenever X" | `update-config` — a hook in settings.json; memory cannot enforce it |
| Session lifecycle | mid-task → `ecc:checkpoint`; end → `ecc:save-session` + `ecc:learn`; new skill → `superpowers:writing-skills`, `skill-creator:skill-creator` |
| Live browser | `chrome-devtools-mcp:chrome-devtools`; slow LCP → `chrome-devtools-mcp:debug-optimize-lcp`; MCP misbehaving → `chrome-devtools-mcp:troubleshooting` |
| Review and quality slash skills | `ecc:code-review`, `ecc:react-review`, `ecc:security-scan`, `ecc:test-coverage`, `ecc:quality-gate`, `ecc:refactor-clean`; red build → `ecc:build-fix`, `ecc:react-build`; PR → `ecc:pr`, `ecc:review-pr`; planning → `ecc:plan`, `ecc:plan-prd`; harness → `ecc:harness-audit` |

### Subagents: task shape → `subagent_type`

Fan out in one message whenever rows are independent; reviewers always run as one parallel batch.

| Task shape | subagent_type | Parallelism |
|---|---|---|
| Locate code, files, callers (read-only) | `Explore` + `caveman:cavecrew-investigator`; deeper → `ecc:code-explorer`, `feature-dev:code-explorer` | both in one message, results merged |
| Design the change | `Plan`, `ecc:planner`; structure → `ecc:code-architect`, `feature-dev:code-architect`; system-level → `ecc:architect` | one at a time; output goes into the plan file |
| Library API question | `ecc:docs-lookup` (context7 under the hood) | alongside the explorers |
| 1–2 file surgical edit | `caveman:cavecrew-builder` | serial per file |
| Multi-file implementation from a plan | `general-purpose`, one per independent task | parallel only on disjoint paths |
| Tests first | `ecc:tdd-guide` | before the builder |
| Review after every change — **always** | the batch in pipeline §6 (`feature-dev:code-reviewer` may stand in for `ecc:code-reviewer`) | every applicable one in a single message |
| tsc or build red | `ecc:build-error-resolver`; React-specific → `ecc:react-build-resolver` | serial; re-run the check with `echo "exit: $?"` after |
| Playwright | `ecc:e2e-runner` — `npm run e2e`, port 3400, dist `.next-e2e`; if `auth.setup` fails on the `user_deletions` precondition, report it — never claim e2e passed | after unit tests |
| Performance, a11y architecture | `ecc:performance-optimizer`, `vercel:performance-optimizer`; `ecc:a11y-architect` | parallel with reviewers |
| Cleanup, comments, tests, types | `ecc:refactor-cleaner`, `ecc:code-simplifier`, `ecc:comment-analyzer`, `ecc:pr-test-analyzer`, `ecc:type-design-analyzer` | parallel, after review |
| Docs | `ecc:doc-updater` | after review passes |
| Vercel, AI architecture, Claude Code itself | `vercel:deployment-expert`, `vercel:ai-architect`; `claude-code-guide` | on demand |
| End of a big task | `ecc:agent-evaluator` | last |

Ultracode on: the Workflow tool runs judge panels and adversarial verify (load `workflow-authoring` first); under it the reviewer batch becomes a workflow step instead of ad-hoc Agent calls.

### MCP: server → use for / status

| Server | Tools | Use for | Status |
|---|---|---|---|
| codebase-memory | `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`, `search_code`, `index_repository` | structural questions; a PreToolUse hook on Grep/Glob reminds you | often not connected — then `graphify query` + grep, and say so in the recap |
| context7 | `mcp__plugin_context7_context7__resolve-library-id` → `mcp__plugin_context7_context7__query-docs` | **always** before writing against a library API (Next 16.3, React 19.2, Drizzle 0.45, Auth.js v5 beta, `@base-ui/react` 1.7, Tailwind v4, Vitest 4, Playwright 1.62) | connected |
| chrome-devtools | `mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page`, `take_snapshot`, `take_screenshot`, `list_console_messages`, `list_network_requests`, `lighthouse_audit`, `performance_start_trace` | live verification of any UI change against the 3400 server you started (never 3000) | connected; `mcp__plugin_ecc_chrome-devtools__*` is an identical second copy |
| mobbin | `mcp__mobbin__search_screens`, `mcp__mobbin__search_flows`, `mcp__mobbin__search_sections` | design references before a new page or flow | connected |
| claude.ai Vercel, figma, supabase | — | deploy status, Figma files, Supabase | need user OAuth — report unavailable, continue |
| github | — | pushes and PRs are the user's | fails (bad auth header) — report, continue |
| codex | — | — | not installed |
