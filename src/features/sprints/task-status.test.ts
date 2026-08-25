import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { transitionTaskStatus } from './task-status'

// A named instant rather than `new Date()`: the whole reason `now` is a
// parameter is so the expected value can be written down.
const NOW = new Date('2026-08-21T09:30:00.000Z')

describe('entering done', () => {
  it('stamps the completion time on todo -> done', () => {
    expect(transitionTaskStatus('todo', 'done', NOW)).toEqual({
      status: 'done',
      completedAt: NOW,
    })
  })

  it('stamps on in_progress -> done too — the ordinary board drag', () => {
    expect(transitionTaskStatus('in_progress', 'done', NOW)).toEqual({
      status: 'done',
      completedAt: NOW,
    })
  })

  it('stamps on an insert that is born done', () => {
    // createTask with status 'done' — logging something already finished.
    // There is no previous status, and that is not a reason to skip the stamp.
    expect(transitionTaskStatus(null, 'done', NOW)).toEqual({
      status: 'done',
      completedAt: NOW,
    })
  })
})

describe('leaving done', () => {
  it('clears the completion time on done -> todo', () => {
    expect(transitionTaskStatus('done', 'todo', NOW)).toEqual({
      status: 'todo',
      completedAt: null,
    })
  })

  it('clears on done -> in_progress', () => {
    expect(transitionTaskStatus('done', 'in_progress', NOW)).toEqual({
      status: 'in_progress',
      completedAt: null,
    })
  })

  it('clears with an explicit null, not by omitting the column', () => {
    // The distinction the type exists for: omitting would leave the old stamp
    // on a task that is visibly back in progress.
    const patch = transitionTaskStatus('done', 'todo', NOW)
    expect('completedAt' in patch).toBe(true)
    expect(patch.completedAt).toBeNull()
  })
})

describe('transitions that must not touch the column', () => {
  it('leaves the ORIGINAL stamp alone on done -> done', () => {
    // The task dialog re-sends every field on every save. If an unchanged
    // 'done' rewrote completed_at, a typo fix three weeks later would report
    // as the completion time.
    const patch = transitionTaskStatus('done', 'done', NOW)
    expect(patch).toEqual({ status: 'done' })
    expect('completedAt' in patch).toBe(false)
  })

  it('touches nothing on todo -> in_progress', () => {
    const patch = transitionTaskStatus('todo', 'in_progress', NOW)
    expect(patch).toEqual({ status: 'in_progress' })
    expect('completedAt' in patch).toBe(false)
  })

  it('touches nothing on todo -> todo or in_progress -> in_progress', () => {
    expect(transitionTaskStatus('todo', 'todo', NOW)).toEqual({ status: 'todo' })
    expect(transitionTaskStatus('in_progress', 'in_progress', NOW)).toEqual({
      status: 'in_progress',
    })
  })

  it('leaves the column alone for an insert that is not done', () => {
    // The DB default is NULL; mentioning the column would only restate it.
    expect(transitionTaskStatus(null, 'todo', NOW)).toEqual({ status: 'todo' })
    expect(transitionTaskStatus(null, 'in_progress', NOW)).toEqual({ status: 'in_progress' })
  })
})

describe('the patch is the only thing the caller spreads', () => {
  it('covers all nine transitions plus the two inserts, with no other keys', () => {
    // Guards the shape rather than the values: a patch that grew a third key
    // would be written by callers that spread it and read by nobody.
    const statuses = ['todo', 'in_progress', 'done'] as const
    for (const current of [...statuses, null]) {
      for (const next of statuses) {
        const patch = transitionTaskStatus(current, next, NOW)
        expect(Object.keys(patch).sort()).toEqual(
          next === 'done'
            ? current === 'done'
              ? ['status']
              : ['completedAt', 'status']
            : current === 'done'
              ? ['completedAt', 'status']
              : ['status'],
        )
        expect(patch.status).toBe(next)
      }
    }
  })
})

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
    // This proves today's output is unchanged — nothing more. Within WS0's
    // type domain 'done' is the only terminal status, so `next === 'done'`
    // and `isTerminal(next)` are truth-table identical and no runtime
    // assertion here can tell them apart. The source-guard describe block
    // below is what actually pins the stamp condition to the literal.
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

describe('the stamp/clear asymmetry is pinned in the SOURCE, not just the output', () => {
  // Within WS0's type domain, `next === 'done'` and `isTerminal(next)` are
  // truth-table identical (TERMINAL holds only 'done'), so no runtime
  // assertion above can tell a correctly-literal stamp condition apart from
  // one accidentally routed through isTerminal — both produce the same
  // observable patch today and only diverge once WS2 adds 'cancelled'. This
  // is a static guard instead: it reads task-status.ts's own text and checks
  // which condition each branch actually uses, the same idiom as
  // src/db/live.test.ts and src/features/search/registry/registry.test.ts.
  //
  // Anchored on the two `if (` lines specifically — not the whole file —
  // because the surrounding comments mention both 'isTerminal' and the done
  // literal and would defeat a naive whole-file substring match.
  const source = readFileSync(path.resolve(__dirname, 'task-status.ts'), 'utf8')
  const ifLines = source.split('\n').filter((line) => line.trim().startsWith('if ('))

  const stampLine = ifLines.find((line) => line.includes('completedAt: now'))
  const clearLine = ifLines.find((line) => line.includes('completedAt: null'))

  it('found exactly one stamp line and one clear line to check', () => {
    // A guard against the guard going stale silently: if a future edit
    // reshapes these into multi-line ifs or renames the return shape, this
    // fails loudly instead of the two checks below silently checking nothing
    // (`.find` over an empty match returns undefined, not a failure).
    expect(stampLine, 'expected one `if (...) return { ..., completedAt: now }` line').toBeDefined()
    expect(clearLine, 'expected one `if (...) return { ..., completedAt: null }` line').toBeDefined()
  })

  it('the stamp condition compares against the done literal, not isTerminal', () => {
    expect(
      stampLine!.includes("current !== 'done'"),
      'stamp condition must read current !== \'done\' — entering a terminal state is only a completion when the state entered is \'done\' specifically',
    ).toBe(true)
    expect(
      stampLine!.includes('isTerminal'),
      'routing the stamp through isTerminal would make todo -> cancelled stamp a completion time on work that was never completed',
    ).toBe(false)
  })

  it('the clear condition routes through isTerminal', () => {
    expect(
      clearLine!.includes('isTerminal'),
      'clear condition must route through isTerminal — leaving ANY terminal state is reopening, not just leaving done',
    ).toBe(true)
  })
})
