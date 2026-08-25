# WS0 — Terminal-Status Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `isTerminal()` / `OPEN_STATUSES` and route every `task_status` comparison through them, so that a later widening of `task_status` is a one-line edit instead of a 35-site hunt.

**Architecture:** One derived source of truth — a `TERMINAL` set in `board-view.ts` (the module that already owns `TASK_STATUSES`), with `OPEN_STATUSES` computed from it and `isTerminal()` reading it. Both are re-exported from `task-status.ts` so callers may import from either. Call sites are then converted in six reviewable batches grouped by *kind of edit*, not by directory: in-memory predicates, the `completed_at` transition, drizzle condition builders, `sql` templates, activity verbs, and UI labels.

**Tech Stack:** TypeScript, Next.js 16 App Router, Drizzle ORM (neon-http), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-multi-discipline-projects-design.md` (§ WS0)

## Global Constraints

- **Behaviour must not change.** In this workstream `TERMINAL` contains exactly `'done'`, so `isTerminal(s)` is definitionally `s === 'done'` and `OPEN_STATUSES` is exactly `['todo', 'in_progress']`. Every edit here is a refactor. Any diff that changes an observable result is a bug in this plan.
- **No migration. No schema change. No enum change.** Those are WS2.
- `npm test` **does not typecheck** (`vitest.config.ts:9` globs only `src/**/*.test.ts`, no `typecheck` block). Every verification step therefore runs `npx tsc --noEmit` *separately*.
- Baseline before starting: `npx tsc --noEmit` clean, `npm test` green, `npm run lint` clean. Record the test count — it was 4221 across 242 files on `817bf89`, but a parallel session is adding tests, so **re-measure at branch point** and compare against your own baseline, never against this number.
- **`main` is shared with other live Claude sessions.** Never `git stash`, never `git add -A`, never `commit -a`, never `reset --hard`, never `checkout -- .`. Stage explicit paths and commit with `git commit --only <paths>`. `e2e/.auth/state.json` is tracked and carries session tokens — never commit changes to it.
- A parallel session is **holding** on `src/features/sprints/task-actions.ts` until this workstream lands. Task 7 touches that file; get it in promptly.
- **Do not touch sibling enums.** `'done'` is also a value of `sprint_status` (`sprint-date-range.ts:131`), `MeterPhase` (`gemini/ai-meter.ts:25`), `SegmentPhase` (`meetings/segment-queue.ts:26`) and `DONE_STATUSES` (`lib/escalation.ts:109`). 68 of the 129 `'done'` occurrences in `src/` belong to those or are comment prose. **Never grep-and-replace the literal.** Only the sites named in this plan are converted.

---

## File Structure

**Modified — the seam:**
- `src/features/sprints/board-view.ts` — gains `TERMINAL`, `isTerminal`, `OPEN_STATUSES` beside `TASK_STATUSES`, which it already owns. Chosen over `task-status.ts` because `board-view.ts` currently imports **nothing** (first statement is line 30) while `task-status.ts` type-imports `TaskStatus` *from* it; defining the helpers in `task-status.ts` and importing them back would turn a leaf module into an import-cycle participant.
- `src/features/sprints/task-status.ts` — re-exports both, and converts its own `completed_at` rule.

**Modified — call sites (in-memory predicates):** `board-view.ts`, `plan-read.ts`, `checkins.ts`, `people/task-workload.ts`, `meetings/ask-derivation.ts`, `meetings/notes.ts`, `meetings/planner.ts`, `meetings/followups.ts`

**Modified — drizzle condition builders:** `sprints/suggest-actions.ts`, `meetings/ai-actions.ts`, `meetings/load-actions.ts`, `meetings/planner-actions.ts`, `people/handover-queries.ts`, `people/queries.ts`

**Modified — `sql` templates:** `apps/queries.ts`, `apps/contribution-queries.ts`, `people/queries.ts`

**Modified — verbs and labels:** `sprints/task-actions.ts`, `worklog/components/day-hours-card.tsx`

**Created:** `src/features/people/queries.test.ts` — `people/queries.ts` has **no test file at all** and Task 6 edits two of its lines.

**Deliberately NOT modified:** `src/db/schema.ts:486` (partial-index DDL — changing it desyncs `schema.ts` from the applied migration; WS2 rebuilds it) and `src/features/worklog/entry-queries.ts:128` (a `case` expression that encodes terminal semantics with no `'done'` literal in it; WS2).

---

### Task 1: The seam

**Files:**
- Modify: `src/features/sprints/board-view.ts:30-31` (insert after)
- Modify: `src/features/sprints/task-status.ts:30` (insert after the existing import)
- Test: `src/features/sprints/board-view.test.ts` (exists — append a describe block)

**Interfaces:**
- Consumes: `TASK_STATUSES`, `TaskStatus` — both already exported from `board-view.ts:30-31`.
- Produces:
  - `isTerminal(status: TaskStatus): boolean` — exported from `board-view.ts`, re-exported from `task-status.ts`
  - `OPEN_STATUSES: readonly TaskStatus[]` — same
  - `TERMINAL_STATUSES: readonly TaskStatus[]` — same

- [ ] **Step 1: Write the failing test**

Append to `src/features/sprints/board-view.test.ts`:

```typescript
describe('terminal status seam', () => {
  it('treats done as terminal and nothing else, today', () => {
    expect(isTerminal('done')).toBe(true)
    expect(isTerminal('todo')).toBe(false)
    expect(isTerminal('in_progress')).toBe(false)
  })

  it('derives OPEN_STATUSES as exactly the non-terminal statuses', () => {
    // Not a hardcoded ['todo','in_progress']: the point of the seam is that
    // this list follows TERMINAL_STATUSES automatically when the enum widens.
    expect([...OPEN_STATUSES]).toEqual(['todo', 'in_progress'])
    expect(OPEN_STATUSES.every((s) => !isTerminal(s))).toBe(true)
  })

  it('partitions TASK_STATUSES with no overlap and no gap', () => {
    // The invariant the whole workstream rests on. If a future status is added
    // to TASK_STATUSES and to neither set, this fails and names the omission.
    const open = new Set<string>(OPEN_STATUSES)
    const terminal = new Set<string>(TERMINAL_STATUSES)
    for (const status of TASK_STATUSES) {
      expect(open.has(status) !== terminal.has(status)).toBe(true)
    }
    expect(open.size + terminal.size).toBe(TASK_STATUSES.length)
  })

  it('is behaviourally identical to the literal it replaces', () => {
    // Pins WS0's contract: this commit changes no behaviour. Delete this test
    // in WS2, when it stops being true on purpose.
    for (const status of TASK_STATUSES) {
      expect(isTerminal(status)).toBe(status === 'done')
    }
  })
})
```

Add to that file's existing import from `'./board-view'`: `TASK_STATUSES`, `isTerminal`, `OPEN_STATUSES`, `TERMINAL_STATUSES`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sprints/board-view.test.ts -t "terminal status seam"`
Expected: FAIL — `isTerminal is not a function` / import errors for the three new names.

- [ ] **Step 3: Write the implementation**

In `src/features/sprints/board-view.ts`, immediately after line 31 (`export type TaskStatus = ...`):

```typescript
/**
 * WHICH STATUSES MEAN "THIS TASK IS OVER".
 *
 * One set, derived one way: `TERMINAL` is the declaration, `OPEN_STATUSES` is
 * computed from it, and `isTerminal` reads it. Adding a status to the enum
 * means editing this Set and nothing else — which is the entire reason this
 * seam exists. Before it, "is this task finished" was the literal `'done'`
 * written out at 35 separate call sites, four of which were `sql` templates.
 *
 * It lives HERE, in the module that already owns `TASK_STATUSES`, rather than
 * in task-status.ts where it is used most: board-view.ts imports nothing at
 * all today, and task-status.ts type-imports `TaskStatus` from it. Defining
 * these there and importing them back would make a leaf module part of an
 * import cycle. task-status.ts re-exports them, so callers may import from
 * either and no call site cares which.
 *
 * NOT a `readonly string[]` include-check: a Set makes the membership test
 * O(1) at the board-render sites that call it per task, and the type keeps a
 * typo from compiling.
 */
const TERMINAL: ReadonlySet<TaskStatus> = new Set<TaskStatus>(['done'])

/** The statuses a task can hold and still be somebody's outstanding work. */
export const OPEN_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter(
  (status) => !TERMINAL.has(status),
)

/** The statuses that mean the task is over, however it ended. */
export const TERMINAL_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter((status) =>
  TERMINAL.has(status),
)

/**
 * Whether this status means the task is finished — by any route.
 *
 * Today that is exactly `'done'`. Callers must not assume it stays that way;
 * that assumption is the thing being removed.
 */
export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL.has(status)
}
```

In `src/features/sprints/task-status.ts`, after the existing `import type { TaskStatus }` on line 30:

```typescript
// Re-exported so the module that owns the completed_at rule also offers the
// terminal test, and callers need not know the helpers are declared next door
// in board-view.ts (which owns TASK_STATUSES). See the comment there for why
// they are not declared in this file.
export { isTerminal, OPEN_STATUSES, TERMINAL_STATUSES } from '@/features/sprints/board-view'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/sprints/board-view.test.ts` — Expected: PASS, all tests in file.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Verify no import cycle was created**

Run: `grep -n "^import" src/features/sprints/board-view.ts`
Expected: **no output.** `board-view.ts` must still import nothing. If this prints an import line, the helpers were put in the wrong module — go back to Step 3.

- [ ] **Step 6: Commit**

```bash
git add src/features/sprints/board-view.ts src/features/sprints/task-status.ts src/features/sprints/board-view.test.ts
git commit --only src/features/sprints/board-view.ts src/features/sprints/task-status.ts src/features/sprints/board-view.test.ts \
  -m "refactor(tasks): add isTerminal/OPEN_STATUSES seam beside TASK_STATUSES

One derived source for 'which statuses mean this task is over'. TERMINAL is
the declaration; OPEN_STATUSES and TERMINAL_STATUSES are computed from it.
No call site converted yet and no behaviour change: TERMINAL holds exactly
'done', so isTerminal(s) is s === 'done' and a test pins that equivalence.

Declared in board-view.ts rather than task-status.ts on purpose. board-view.ts
imports nothing and task-status.ts type-imports TaskStatus from it; declaring
them in task-status.ts and importing back would make a leaf module part of an
import cycle. task-status.ts re-exports them."
```

---

### Task 2: Pair guard for `people/queries.ts`

`src/features/people/queries.ts` has **no test file**, and Task 6 edits two of its lines. They are a complementary pair inside `getPersonWorkload` (`:844` filters open tasks, `:849` counts done ones against the same column). Convert one without the other and the page reports `openTasks.length` and `doneCount` that no longer partition `totalCount` — no error, no type failure, just two numbers that stop agreeing.

`getPersonWorkload` is wrapped in React `cache()` and runs two queries in a `Promise.all`; mocking that chain would mostly test the mock. This repo already has the idiom for "two things that must agree and nothing connects them": a **source-scanning guard test**, as used by `src/db/live.test.ts` and `src/features/search/registry/registry.test.ts`. That is what this task writes.

**Files:**
- Create: `src/features/people/queries.test.ts`

**Interfaces:**
- Consumes: nothing. It reads source text, so it works before, during, and after the conversion.
- Produces: a guard that fails if Tasks 5 and 6 convert one half of the pair.

- [ ] **Step 1: Write the guard test**

Create `src/features/people/queries.test.ts`:

```typescript
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `getPersonWorkload` asks the SAME question twice, in two different queries
 * that are built independently and never compared by the compiler:
 *
 *   - the open-task list  — `.where(... liveTasks.status ...)`, the rows shown
 *   - the lifetime counts — `count(*) filter (where ... liveTasks.status ...)`
 *
 * `openTasks.length` and `doneCount` are rendered on the same person page and
 * are expected to partition `totalCount`. Nothing enforces that. If one filter
 * learns about a new status and the other does not, the page shows two numbers
 * that quietly stop adding up — the failure mode has no exception and no type
 * error, which is exactly why it needs a source guard rather than a unit test.
 *
 * Scans text rather than executing the query because `getPersonWorkload` is
 * `cache()`-wrapped and runs both queries inside one `Promise.all`; a mock deep
 * enough to reach the conditions would be asserting on the mock.
 */
const SOURCE = readFileSync(join(process.cwd(), 'src/features/people/queries.ts'), 'utf8')

/** The body of getPersonWorkload, where both halves of the pair live. */
function personWorkloadBody(): string {
  const start = SOURCE.indexOf('export const getPersonWorkload')
  expect(start, 'getPersonWorkload not found — was it renamed?').toBeGreaterThan(-1)
  // Ends at the next top-level `export const`/`export function`, or EOF.
  const rest = SOURCE.slice(start + 1)
  const next = rest.search(/\nexport (const|function|async function) /)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('getPersonWorkload open/done pair', () => {
  it('references liveTasks.status exactly twice — the open filter and the done count', () => {
    // If this number changes, a third status read was added and this guard has
    // to learn about it deliberately rather than silently covering two of three.
    const body = personWorkloadBody()
    const reads = body.match(/liveTasks\.status/g) ?? []
    expect(reads).toHaveLength(2)
  })

  it('routes BOTH halves through the seam, or neither', () => {
    // The whole point. During WS0 this starts green (neither half routed) and
    // stays green (both routed). It goes red for exactly one commit-shaped
    // mistake: converting the open filter and forgetting the done count, or
    // the reverse.
    const body = personWorkloadBody()
    const openFilter = body.slice(body.indexOf('.where(and(eq(liveTasks.assigneeId'))
    const doneCount = body.slice(body.indexOf('count(*) filter'))

    const openUsesSeam = /OPEN_STATUSES/.test(openFilter.slice(0, 200))
    const doneUsesSeam = /OPEN_STATUSES/.test(doneCount.slice(0, 200))

    expect(
      openUsesSeam,
      openUsesSeam === doneUsesSeam
        ? ''
        : 'The open filter and the done count in getPersonWorkload disagree about ' +
          'whether a task is finished. Route both through OPEN_STATUSES or neither — ' +
          'see docs/superpowers/plans/2026-08-25-ws0-terminal-status-seam.md Task 6.',
    ).toBe(doneUsesSeam)
  })

  it('never asks whether a status equals the bare string done', () => {
    // Guards the shape the seam removes. `= 'done'` and `<> 'done'` are the two
    // spellings that silently miscount the moment the enum widens.
    const body = personWorkloadBody()
    expect(body).not.toMatch(/status,\s*'done'/)
  })
})
```

- [ ] **Step 2: Run against unmodified code**

Run: `npx vitest run src/features/people/queries.test.ts`

Expected: the first two tests **PASS** (neither half is routed yet, so they agree), and the third **FAILS** — `:844` still contains `ne(liveTasks.status, 'done')`. Both halves are converted together in Task 6, so the pair guard is never red between commits.

- [ ] **Step 3: Mark the third test as the one Task 5 turns green**

That third failure is correct and wanted: it is the red test that Task 6 makes pass. Add `.fails` to it so the suite is green now and the assertion still runs:

```typescript
  it.fails('never asks whether a status equals the bare string done', () => {
```

with a comment above it:

```typescript
  // it.fails until Task 6 converts :844 and :849. Vitest fails this test if the body
  // ever PASSES, so the marker cannot be forgotten — the moment the literal
  // is gone this goes red and the `.fails` must be removed. Self-deleting.
```

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/features/people/queries.test.ts` — Expected: PASS, 3 tests.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/people/queries.test.ts
git commit --only src/features/people/queries.test.ts \
  -m "test(people): guard the open/done pair in getPersonWorkload

people/queries.ts had no test file, and two of its lines ask the same question
in two independently-built queries: :844 filters open tasks, :849 counts done
ones. openTasks.length and doneCount are rendered on the same page and expected
to partition totalCount, but nothing enforces it — convert one and not the
other and the numbers quietly stop adding up, with no exception and no type
error.

A source-scanning guard rather than a unit test: getPersonWorkload is
cache()-wrapped and runs both queries in one Promise.all, so a mock deep enough
to reach the conditions would be asserting on the mock. Same idiom as
live.test.ts. The third assertion is it.fails until Task 6 lands, and vitest
turns it red the moment it starts passing, so the marker cannot be forgotten."
```

### Task 3: The `completed_at` transition

The subtle one. `transitionTaskStatus` decides `completed_at`, a column its own docblock calls "a hole" once written badly — it cannot be reconstructed. The seam is applied **asymmetrically here on purpose**, and the asymmetry is the design, not an oversight.

**Files:**
- Modify: `src/features/sprints/task-status.ts:72-73`
- Test: `src/features/sprints/task-status.test.ts` (exists)

**Interfaces:**
- Consumes: `isTerminal` (Task 1).
- Produces: no signature change. `transitionTaskStatus(current, next, now)` keeps its shape.

**The rule, stated exactly:**

| condition | today | after this task | why |
|---|---|---|---|
| stamp `completedAt: now` | `next === 'done' && current !== 'done'` | **unchanged** | Per spec decision 14, cancelling never stamps. If this became `isTerminal(next)`, `todo -> cancelled` would stamp a completion time on work that was never completed. |
| clear `completedAt: null` | `next !== 'done' && current === 'done'` | `!isTerminal(next) && current !== null && isTerminal(current)` | Clearing is tied to **reopening**. A task leaving any terminal state for a live one has no completion time any more. |
| leave alone | everything else | everything else | `done -> cancelled` lands here and **keeps** its original stamp — it really was finished on that date, and no other record of when survives. |

In WS0 these are behaviourally identical, because `isTerminal(s) === (s === 'done')`.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/sprints/task-status.test.ts`:

```typescript
describe('the rule is expressed against the terminal SET, not the done literal', () => {
  it('clears via isTerminal, so a future terminal status also counts as reopening', () => {
    // Same observable answer as today. What changed is what the code reads:
    // "was this terminal" instead of "was this the string done".
    expect(transitionTaskStatus('done', 'in_progress', NOW)).toEqual({
      status: 'in_progress',
      completedAt: null,
    })
  })

  it('still stamps ONLY on entering done, never on entering some other terminal state', () => {
    // Pinned deliberately: when WS2 adds 'cancelled', todo -> cancelled must
    // NOT stamp a completion time. Routing the stamp through isTerminal would
    // break this, which is why the stamp keeps the literal and the clear does
    // not. This test is the reason that asymmetry survives review.
    expect(transitionTaskStatus('todo', 'done', NOW)).toEqual({
      status: 'done',
      completedAt: NOW,
    })
  })

  it('never dereferences a null current', () => {
    // current is null on INSERT. isTerminal takes TaskStatus, not TaskStatus|null.
    expect(transitionTaskStatus(null, 'todo', NOW)).toEqual({ status: 'todo' })
    expect(transitionTaskStatus(null, 'done', NOW)).toEqual({ status: 'done', completedAt: NOW })
  })
})
```

- [ ] **Step 2: Run to verify they pass against unmodified code**

Run: `npx vitest run src/features/sprints/task-status.test.ts`
Expected: **PASS.** These are characterization tests — WS0 changes no behaviour, so they must already hold. If any fails now, the rule table above is wrong; stop and re-read the file.

- [ ] **Step 3: Apply the seam**

In `src/features/sprints/task-status.ts`, replace lines 72-73:

```typescript
  const wasDone = current === 'done'
  const isDone = next === 'done'
```

with:

```typescript
  // ASYMMETRIC ON PURPOSE, and the asymmetry is the whole decision.
  //
  // Leaving a terminal state is REOPENING, whatever the terminal state was —
  // so the clear condition asks isTerminal. Entering one is only a COMPLETION
  // when the state entered is 'done' specifically — so the stamp condition
  // keeps the literal.
  //
  // Route the stamp through isTerminal too and `todo -> cancelled` writes a
  // completion time onto work that was never completed, which every
  // throughput, cycle-time and streak reader downstream would then believe.
  // `done -> cancelled` falls through both branches and KEEPS its original
  // stamp: the task really was finished on that date, and this column is the
  // only place that fact is recorded.
  const wasTerminal = current !== null && isTerminal(current)
  const isCompletion = next === 'done'
```

Then update the three uses below:
- Line 76: `if (isDone && !wasDone)` becomes `if (isCompletion && !wasTerminal)`
- Line 81: `if (!isDone && wasDone)` becomes `if (!isTerminal(next) && wasTerminal)`
- Line 83's comment: change `// done -> done, and every transition between the two unfinished states.` to `// done -> done, terminal -> terminal, and every transition between open states.`

Add `isTerminal` to the re-export line's own imports — it is re-exported but must also be *imported* to be called:

```typescript
import { isTerminal } from '@/features/sprints/board-view'
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/sprints/task-status.test.ts` — Expected: PASS, every test including the pre-existing nine-transition shape guard.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/sprints/task-status.ts src/features/sprints/task-status.test.ts
git commit --only src/features/sprints/task-status.ts src/features/sprints/task-status.test.ts \
  -m "refactor(tasks): express the completed_at rule against the terminal set

Leaving a terminal state is reopening, so the clear condition now asks
isTerminal. Entering one is a completion only when the state entered is 'done',
so the stamp condition keeps the literal. That asymmetry is deliberate: routing
the stamp through isTerminal would make todo -> cancelled stamp a completion
time on work that was never completed, and done -> cancelled must keep its
original stamp because nothing else records when the task finished.

Behaviour unchanged today — TERMINAL holds only 'done'. Tests pin the
asymmetry so it survives the WS2 widening."
```

---

### Task 4: In-memory predicate sites

Eight files, eleven sites, all the same edit: an in-memory filter or guard comparing a task's status to `'done'`.

**Files:**
- Modify: `src/features/sprints/board-view.ts:162,168,364`
- Modify: `src/features/sprints/plan-read.ts:208`
- Modify: `src/features/sprints/checkins.ts:39`
- Modify: `src/features/people/task-workload.ts:104,129`
- Modify: `src/features/meetings/ask-derivation.ts:50`
- Modify: `src/features/meetings/notes.ts:607`
- Modify: `src/features/meetings/planner.ts:403`
- Modify: `src/features/meetings/followups.ts:376,377`

**Interfaces:**
- Consumes: `isTerminal` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Convert the sites**

`board-view.ts` — three sites, and it needs **no import** (the helper is declared in this file):

```typescript
// :162  before: if (task.status === 'done') return false
if (isTerminal(task.status)) return false

// :168  before: if (task.status === 'done') return false
if (isTerminal(task.status)) return false

// :364  before: if (task.status === 'done') done += 1
if (isTerminal(task.status)) done += 1
```

`plan-read.ts:208`:

```typescript
// before: const open = tasks.filter((task) => task.status !== 'done')
const open = tasks.filter((task) => !isTerminal(task.status))
```

`checkins.ts:39` — **needs a cast.** `TaskForProgress.status` is deliberately bare `string` (`checkins.ts:8`) to keep this module DB-free, so `isTerminal(task.status)` fails `TS2345`:

```typescript
// before: const done = mine.filter((task) => task.status === 'done').length
const done = mine.filter((task) => isTerminal(task.status as TaskStatus)).length
```

Import in `checkins.ts`: `import { isTerminal, type TaskStatus } from '@/features/sprints/board-view'`

Also **rewrite the comment at `checkins.ts:29`**, which currently states the opposite of what the seam encodes:

```typescript
 * Statuses other than 'done' all count as not-done rather than being
 * enumerated: an in-progress task is incomplete for this purpose, and a new
 * status added to the enum later should default to "not finished yet"
 * instead of silently inflating percentages.
```

becomes:

```typescript
 * Finished means `isTerminal`, not the literal 'done'. NOTE FOR WS2: the
 * numerator is routed through the seam but the denominator (`total`, below)
 * is every task assigned to this person regardless of status. When the enum
 * widens, a cancelled task will therefore count as finished in this
 * percentage and in the standup gap check built on it. That is an open
 * product question — is cancelled work "done" at standup, or does it leave
 * the denominator entirely? — and it must be answered before 'cancelled'
 * ships, not after.
```

`task-workload.ts:104` and `:129` — identical edit at both, and both must land together:

```typescript
// before: const open = rows.filter((row) => row.status !== 'done')
const open = rows.filter((row) => !isTerminal(row.status))
```

`ask-derivation.ts:50`:

```typescript
// before: if (task.status === 'done') return false
if (isTerminal(task.status)) return false
```

`notes.ts:607`:

```typescript
// before: const open = mine.filter((task) => task.status !== 'done')
const open = mine.filter((task) => !isTerminal(task.status))
```

`planner.ts:403`:

```typescript
// before: (task) => task.assigneeId === null && task.status !== 'done',
(task) => task.assigneeId === null && !isTerminal(task.status),
```

`followups.ts:376-377` — convert **both or neither**:

```typescript
// before: const wasDone = fromStatus === 'done'
//         const isDone = toStatus === 'done'
const wasDone = isTerminal(fromStatus)
const isDone = isTerminal(toStatus)
```

Each file except `board-view.ts` needs `import { isTerminal } from '@/features/sprints/board-view'` added to its existing import block.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: clean. A `TS2345` here means a call site's status type is wider than `TaskStatus` — add a cast **only** where the local type is deliberately loose, as at `checkins.ts`. Never widen `isTerminal`'s parameter to `string` to make an error go away; that removes the typo protection the seam exists to provide.

- [ ] **Step 3: Run the affected suites**

Run: `npx vitest run src/features/sprints src/features/people src/features/meetings`
Expected: PASS, same count as baseline.

- [ ] **Step 4: Commit**

```bash
git add src/features/sprints/board-view.ts src/features/sprints/plan-read.ts src/features/sprints/checkins.ts src/features/people/task-workload.ts src/features/meetings/ask-derivation.ts src/features/meetings/notes.ts src/features/meetings/planner.ts src/features/meetings/followups.ts
git commit --only src/features/sprints/board-view.ts src/features/sprints/plan-read.ts src/features/sprints/checkins.ts src/features/people/task-workload.ts src/features/meetings/ask-derivation.ts src/features/meetings/notes.ts src/features/meetings/planner.ts src/features/meetings/followups.ts \
  -m "refactor(tasks): route in-memory status predicates through isTerminal

Eleven sites across eight files, all the same shape: an in-memory filter or
guard asking whether a task is finished. No behaviour change.

checkins.ts needs a cast because TaskForProgress.status is deliberately bare
string to keep that module DB-free, and its docblock is rewritten: it claimed a
new status would default to 'not finished yet', which is the opposite of what
the seam encodes. The real open question it now records is that the numerator
is routed and the denominator is not, so cancelled work will count as finished
in the standup percentage until WS2 decides otherwise."
```

---

### Task 5: Drizzle condition builders

Five sites where `ne(liveTasks.status, 'done')` means "open". Converting to `inArray(..., OPEN_STATUSES)` is what makes them survive the widening — `ne(status, 'done')` would count a cancelled task as open.

**Files:**
- Modify: `src/features/sprints/suggest-actions.ts:65` (+ import line 4)
- Modify: `src/features/meetings/ai-actions.ts:684`
- Modify: `src/features/meetings/load-actions.ts:174` (+ import line 3)
- Modify: `src/features/meetings/planner-actions.ts:139`
- Modify: `src/features/people/handover-queries.ts:86,177` (+ import line 1)

**Deliberately NOT here:** `src/features/people/queries.ts:844`. It is the same
`ne(status, 'done')` shape as the five above and belongs with them by *kind* —
but it is one half of a complementary pair with `:849`, which is a `sql`
template converted in Task 6. Splitting them across two commits leaves the
Task 2 pair guard red in between. They convert together, in Task 6.

**Interfaces:**
- Consumes: `OPEN_STATUSES` (Task 1).
- Produces: nothing new.

**Typing rule, verified by compilation:** `liveTasks.status` is a `PgColumn`. `inArray`'s matching overload takes a `ReadonlyArray`, so `OPEN_STATUSES` is passed **directly, without a spread**. (`notInArray` differs — see Task 6.)

- [ ] **Step 1: Convert the sites**

`suggest-actions.ts:65`:

```typescript
// before: .where(and(eq(liveTasks.appId, parsedId.data), ne(liveTasks.status, 'done')))
.where(and(eq(liveTasks.appId, parsedId.data), inArray(liveTasks.status, OPEN_STATUSES)))
```

`ai-actions.ts:684` — `inArray` is already imported at line 6; `ne` stays (still used at `:807` and `:847`):

```typescript
// before: .where(and(inArray(liveTasks.assigneeId, attendeeIds), ne(liveTasks.status, 'done')))
.where(and(inArray(liveTasks.assigneeId, attendeeIds), inArray(liveTasks.status, OPEN_STATUSES)))
```

`load-actions.ts:174`:

```typescript
// before: ne(liveTasks.status, 'done'),
inArray(liveTasks.status, OPEN_STATUSES),
```

`planner-actions.ts:139` — `ne` stays (still used at `:184`):

```typescript
// before: .where(and(inArray(liveTasks.appId, appIds), ne(liveTasks.status, 'done'))),
.where(and(inArray(liveTasks.appId, appIds), inArray(liveTasks.status, OPEN_STATUSES))),
```

`handover-queries.ts:86` and `:177` — identical, both must land together:

```typescript
// before: .where(and(eq(liveTasks.assigneeId, userId), ne(liveTasks.status, 'done'))),
.where(and(eq(liveTasks.assigneeId, userId), inArray(liveTasks.status, OPEN_STATUSES))),
```

- [ ] **Step 2: Fix the imports — this WILL break the build if skipped**

In three files, line 65 / 174 / 86+177 were the **only** use of `ne`, so it becomes an unused import and `npm run lint` fails:

- `src/features/sprints/suggest-actions.ts:4` — `import { and, desc, eq, ne } from 'drizzle-orm'` becomes `import { and, desc, eq, inArray } from 'drizzle-orm'`
- `src/features/meetings/load-actions.ts:3` — `import { and, eq, inArray, isNotNull, lt, ne } from 'drizzle-orm'` becomes `import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm'`
- `src/features/people/handover-queries.ts:1` — `import { and, eq, gt, isNull, ne } from 'drizzle-orm'` becomes `import { and, eq, gt, isNull, inArray } from 'drizzle-orm'`

Every one of the five files also needs `import { OPEN_STATUSES } from '@/features/sprints/board-view'`.

Confirm before committing:

```bash
for f in src/features/sprints/suggest-actions.ts src/features/meetings/load-actions.ts src/features/people/handover-queries.ts; do
  echo "$f: ne used $(grep -c '\bne(' "$f") times"
done
```
Expected: `0` for all three. Any non-zero means `ne` is still needed there — keep it in the import.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run lint` — Expected: clean, **no `no-unused-vars` on `ne`**.
Run: `npx vitest run src/features/sprints src/features/meetings src/features/people` — Expected: PASS, **including the Task 2 pair guard**, which is untouched because `people/queries.ts` is not in this commit.

- [ ] **Step 4: Commit**

```bash
git add src/features/sprints/suggest-actions.ts src/features/meetings/ai-actions.ts src/features/meetings/load-actions.ts src/features/meetings/planner-actions.ts src/features/people/handover-queries.ts
git commit --only src/features/sprints/suggest-actions.ts src/features/meetings/ai-actions.ts src/features/meetings/load-actions.ts src/features/meetings/planner-actions.ts src/features/people/handover-queries.ts \
  -m "refactor(tasks): query open work by OPEN_STATUSES, not ne(status, 'done')

Five sites where 'not done' stood in for 'open'. The two stop being the same
thing the moment the enum widens: ne(status,'done') counts a cancelled task as
outstanding work, on the handover list and the meeting planner. Naming the open
set says what these queries actually mean.

people/queries.ts:844 is the same shape but is held back to Task 6: it pairs
with a sql-template done count five lines later, and splitting the pair across
two commits leaves the Task 2 pair guard red in between.

ne was the only drizzle import used in three of these files and is dropped
there; it is still used elsewhere in the other two and stays."
```

---

### Task 6: `sql` template sites

Four `sql`-template sites, plus the drizzle-builder half of one pair held back from Task 5 — seven lines across three files. An earlier reading of the spec claimed the seam could not reach the `sql` ones — **that was wrong**, and the correction matters: a drizzle *condition object* interpolates into a `sql` template, which this repo already does at `apps/queries.ts:78`.

Two of these are **complementary pairs** — a done count beside an open count. Converting one without the other makes them silently disagree.

**Files:**
- Modify: `src/features/apps/queries.ts:152,157,427,429` (+ import line 2)
- Modify: `src/features/apps/contribution-queries.ts:71,72`
- Modify: `src/features/people/queries.ts:844,849` — **both halves of the pair, in this one commit**

**Interfaces:**
- Consumes: `OPEN_STATUSES` (Task 1).
- Produces: nothing new.

**Typing rule, verified by compilation:** `notInArray`'s matching overload takes a **mutable** array, so it needs `[...OPEN_STATUSES]`. `inArray` takes a `ReadonlyArray` and does not. This asymmetry is real; do not "tidy" it into consistency.

- [ ] **Step 1: Convert `apps/queries.ts` — all four, they are two pairs**

```typescript
// :152  before: done: countWhere(eq(liveTasks.status, 'done')),
done: countWhere(notInArray(liveTasks.status, [...OPEN_STATUSES])),

// :157  before: and(ne(liveTasks.status, 'done'), isNotNull(liveTasks.dueDate), lt(liveTasks.dueDate, today)),
and(inArray(liveTasks.status, OPEN_STATUSES), isNotNull(liveTasks.dueDate), lt(liveTasks.dueDate, today)),

// :427  before: done: countWhere(eq(liveTasks.status, 'done')),
done: countWhere(notInArray(liveTasks.status, [...OPEN_STATUSES])),

// :429  before: and(ne(liveTasks.status, 'done'), isNotNull(liveTasks.dueDate), lt(liveTasks.dueDate, today)),
and(inArray(liveTasks.status, OPEN_STATUSES), isNotNull(liveTasks.dueDate), lt(liveTasks.dueDate, today)),
```

Import at line 2: add `inArray` and `notInArray`. `ne` was used only at `:157` and `:429`, so **drop it**; `eq` is used elsewhere in the file, so keep it. Verify with `grep -c '\bne(' src/features/apps/queries.ts` — expected `0`.

Add `import { OPEN_STATUSES } from '@/features/sprints/board-view'`.

- [ ] **Step 2: Convert `contribution-queries.ts` — the pair**

```typescript
// :71  before: done: count(sql`case when ${liveTasks.status} = 'done' then 1 end`),
done: count(sql`case when ${notInArray(liveTasks.status, [...OPEN_STATUSES])} then 1 end`),

// :72  before: open: count(sql`case when ${liveTasks.status} <> 'done' then 1 end`),
open: count(sql`case when ${inArray(liveTasks.status, OPEN_STATUSES)} then 1 end`),
```

Add `inArray`, `notInArray` to the drizzle import and `OPEN_STATUSES` from board-view.

- [ ] **Step 3: Convert `people/queries.ts` — BOTH halves of the pair, together**

These two are the reason Task 2 exists. They are built independently, rendered
on the same page, and expected to partition `totalCount`. Convert both in this
edit; the pair guard goes red if only one lands.

```typescript
// :844  before: .where(and(eq(liveTasks.assigneeId, userId), ne(liveTasks.status, 'done')))
.where(and(eq(liveTasks.assigneeId, userId), inArray(liveTasks.status, OPEN_STATUSES)))

// :849  before: done: sql<number>`count(*) filter (where ${liveTasks.status} = 'done')::int`,
done: sql<number>`count(*) filter (where ${notInArray(liveTasks.status, [...OPEN_STATUSES])})::int`,
```

Imports: `inArray` is already there at line 2; add `notInArray` and
`import { OPEN_STATUSES } from '@/features/sprints/board-view'`. `ne` stays —
still used at `:627`.

Then **remove the `.fails` marker** from the third test in
`src/features/people/queries.test.ts`. Vitest fails an `it.fails` test that
starts passing, so the suite tells you to do this rather than letting the
marker rot.

- [ ] **Step 4: Verify the pairs actually sum**

Run: `npx vitest run src/features/apps/contribution-queries.test.ts src/features/people/queries.test.ts src/features/apps`
Expected: PASS, **3 tests in `queries.test.ts` with no `.fails` marker left**. The Task 2 pair guard is the one that matters here — if its second test fails, `:844` and `:849` have drifted apart and only one was converted.

Run: `npx tsc --noEmit` — Expected: clean. A `TS2769` overload error on `notInArray` means the `[...OPEN_STATUSES]` spread is missing.
Run: `npm run lint` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/apps/queries.ts src/features/apps/contribution-queries.ts src/features/people/queries.ts src/features/people/queries.test.ts
git commit --only src/features/apps/queries.ts src/features/apps/contribution-queries.ts src/features/people/queries.ts src/features/people/queries.test.ts \
  -m "refactor(tasks): route sql-template status filters through OPEN_STATUSES

A drizzle condition interpolates into a sql template — apps/queries.ts:78
already does this — so these four sites are reachable from the seam after all,
and leaving them out would have been the worse outcome. Two of them are
complementary pairs (contribution-queries :71/:72, people/queries :844/:849):
converting one side and not the other makes the counts disagree with no error
and no failing type.

notInArray's overload takes a mutable array so it needs the spread; inArray
takes a ReadonlyArray and does not. The asymmetry is real, not untidiness."
```

---

### Task 7: Activity verbs and UI labels

Behaviour-adjacent rather than purely internal: these decide what a person reads in the activity feed and on the worklog card.

**Files:**
- Modify: `src/features/sprints/task-actions.ts:457,585`
- Modify: `src/features/worklog/components/day-hours-card.tsx:396`

**Interfaces:**
- Consumes: `isTerminal` (Task 1), `STATUS_LABEL` (existing, `board-view.ts:33`).
- Produces: nothing new.

**A parallel session is waiting on `task-actions.ts`.** Notify them once this lands.

- [ ] **Step 1: Convert the activity verbs**

Both lines are already narrowed to non-undefined by the line above them.

```typescript
// :457  before: verb = nextStatus === 'done' ? 'completed' : existing.status === 'done' ? 'reopened' : 'moved'
verb = isTerminal(nextStatus) ? 'completed' : isTerminal(existing.status) ? 'reopened' : 'moved'

// :585  before: verb = status === 'done' ? 'completed' : existing.status === 'done' ? 'reopened' : 'moved'
verb = isTerminal(status) ? 'completed' : isTerminal(existing.status) ? 'reopened' : 'moved'
```

Add `isTerminal` to the existing import from `@/features/sprints/board-view`.

Note for WS2, not for now: when `cancelled` lands, `isTerminal(next)` here produces the verb `'completed'` for a cancellation. That is wrong copy, but it is a *label* problem in a feed, not a data problem, and fixing it means adding a `'cancelled'` verb — which belongs in the commit that adds the status, not this one.

- [ ] **Step 2: Fix the worklog label**

The naive conversion here is a trap: it keeps the hardcoded string `Done`, so a future terminal status would render a cancelled task as "Done". Use the label map instead.

```typescript
// before: hint: task.status === 'done' ? `${task.appName} · Done` : task.appName,
hint: isTerminal(task.status) ? `${task.appName} · ${STATUS_LABEL[task.status]}` : task.appName,
```

Add to the imports: `import { isTerminal, STATUS_LABEL } from '@/features/sprints/board-view'`.

Confirm this file is not a `'use client'` module importing something forbidden — `board-view.ts` is a pure module with no DB or auth imports (it imports nothing at all), so this is safe. Verify with `head -3 src/features/sprints/board-view.ts`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npx vitest run src/features/sprints/task-actions.test.ts src/features/worklog` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/sprints/task-actions.ts src/features/worklog/components/day-hours-card.tsx
git commit --only src/features/sprints/task-actions.ts src/features/worklog/components/day-hours-card.tsx \
  -m "refactor(tasks): route activity verbs and the worklog hint through isTerminal

The worklog hint deliberately reads STATUS_LABEL rather than keeping the
hardcoded string 'Done': the naive conversion would render a future terminal
status as 'Done' on the day card.

Known and deferred: with a widened enum the ternary at task-actions.ts:457/585
labels a cancellation 'completed' in the activity feed. That needs a
'cancelled' verb, which belongs in the commit that adds the status."
```

- [ ] **Step 5: Tell the waiting session**

`task-actions.ts` is now free. Send a message saying the seam has landed, naming the commit, and confirming that no signature, control flow, or `assigneeId` handling changed.

---

### Task 8: Full verification and WS2 handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-08-25-multi-discipline-projects-design.md` (WS0 section — mark complete, record what WS2 inherits)

- [ ] **Step 1: Full green**

```bash
npx tsc --noEmit
npm test
npm run lint
```
Expected: `tsc` clean; test count **equal to or greater than** your recorded baseline with zero failures; lint clean. A *lower* count means a test file stopped being collected — investigate before proceeding.

- [ ] **Step 2: Prove no sibling enum was touched**

```bash
git diff aefdc36..HEAD --stat -- src/features/gemini src/features/meetings/segment-queue.ts \
  src/features/meetings/recording-progress.ts src/features/sprints/sprint-date-range.ts \
  src/features/sprints/actions.ts src/lib/escalation.ts
```
Expected: **empty output.** Any file listed here means a sibling enum was converted — that is the exact regression this plan exists to avoid. Revert that hunk.

- [ ] **Step 3: Prove the remaining literals are the intended ones**

```bash
grep -rn --include='*.ts' --include='*.tsx' -E "'done'|\"done\"" src | grep -v '\.test\.ts' | wc -l
```
Expected: a count **lower** than the 129 baseline, with every survivor being one of: a sibling-enum value, a declaration (`TASK_STATUSES`, a `Record<TaskStatus, …>`, an inline union, the pgEnum), comment prose, `schema.ts:486`, or `entry-queries.ts:128`. Spot-check ten at random.

- [ ] **Step 4: Record the WS2 debt in the spec**

Under WS0 in the spec, mark it landed and add:

```markdown
**Landed.** WS2 inherits four things this workstream deliberately did not do:

1. `schema.ts:486` — the partial index predicate. Unreachable from TS; rebuilt
   with the migration.
2. `worklog/entry-queries.ts:128` — a `case` expression encoding terminal
   semantics with no `'done'` literal in it, so no grep finds it. Its `else 2`
   sorts any future non-terminal status into the done bucket.
3. `checkins.ts` — the numerator is routed, the denominator is not. A cancelled
   task will count as finished in the standup percentage until this is decided.
4. `task-actions.ts:457,:585` — a cancellation will be labelled `'completed'`
   in the activity feed until a `'cancelled'` verb exists.

And the sweep that still has to happen: a class of sites expresses terminal
semantics by enumerating the OPEN states or assuming the enum has exactly three
values, and is invisible to any grep for `done` —
`plan-read.ts:42,:115` · `intel/context-pack.ts:249-250` · `app-health.ts:378` ·
`apps/components/app-card.tsx:100` · `apps/components/app-header.tsx:82` ·
`dashboard/components/dashboard-zones.tsx:963` · `dashboard/sprint-progress.ts:8-9` ·
`worklog/progress-queries.ts:427` · `apps/components/task-split-bar.tsx:55,:74,:104` ·
`sprints/queries.ts:36-40,:275` with its flatteners `apps/[slug]/page.tsx:357`,
`sprints/components/board.tsx:139`, `sprints/components/sprint-checkins.tsx:42` ·
`sprints/search-providers.ts:95`.
**WS2 must sweep on `in_progress`, not on `done`.**
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-25-multi-discipline-projects-design.md
git commit --only docs/superpowers/specs/2026-08-25-multi-discipline-projects-design.md \
  -m "docs(spec): mark WS0 landed and record what WS2 inherits

Four sites deliberately left alone, and the sweep that still has to happen:
a whole class of sites expresses terminal semantics by enumerating the OPEN
states rather than naming 'done', so WS2's sweep keys on in_progress."
```
