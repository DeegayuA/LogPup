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
  it('reads liveTasks.status in exactly two PREDICATES — the open filter and the done count', () => {
    // Counts predicate reads, not every mention. The select list also reads
    // `status: liveTasks.status` as a RETURNED COLUMN, and a returned column
    // makes no claim about whether the task is finished — it is not part of
    // the invariant this file guards. If this number changes, a third
    // PREDICATE was added and this guard has to learn about it deliberately
    // rather than silently covering two of three.
    const body = personWorkloadBody()
    const selectListReads = body.match(/status:\s*liveTasks\.status/g) ?? []
    const allReads = body.match(/liveTasks\.status/g) ?? []
    expect(allReads.length - selectListReads.length).toBe(2)
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

  // it.fails until Task 6 converts :844 and :849. Vitest fails this test if the body
  // ever PASSES, so the marker cannot be forgotten — the moment the literal
  // is gone this goes red and the `.fails` must be removed. Self-deleting.
  it.fails('never asks whether a status equals the bare string done', () => {
    // Guards the shape the seam removes. `= 'done'` and `<> 'done'` are the two
    // spellings that silently miscount the moment the enum widens.
    const body = personWorkloadBody()
    expect(body).not.toMatch(/status,\s*'done'/)
  })
})
