import { describe, expect, it } from 'vitest'
import { planFor } from './composer-plan'

const PEOPLE = [
  { id: 'u1', name: 'Shanika Ayasmanthi' },
  { id: 'u2', name: 'Deeghayu Adhikari' },
  { id: 'u3', name: 'Sam Perera' },
  { id: 'u4', name: 'Sam Fernando' },
]

// Tuesday, 11 Aug 2026 — the same fixed day task-intent.test.ts uses, so
// weekday math is deterministic and the two suites agree what "monday" means.
const TODAY = new Date(2026, 7, 11)

describe('planFor', () => {
  it('reads a resolvable name, the title, and the date', () => {
    const plan = planFor('@shanika fix the login on monday', PEOPLE, TODAY)
    expect(plan?.title).toBe('fix the login')
    expect(plan?.assignee?.id).toBe('u1')
    expect(plan?.due).toBe('2026-08-17')
    expect(plan?.unresolvedQuery).toBeNull()
  })

  /*
   * The regression this suite exists for.
   *
   * An unresolved name used to return the composer's give-up object, which
   * carries the RAW text as the title and nulls for every parsed field — so
   * one unknown teammate silently threw away the due date, the priority and
   * the description the same phrase had just been understood to contain. A
   * name failing to resolve says nothing about the date written beside it.
   */
  it('keeps the date, priority and description when the name resolves to nobody', () => {
    const plan = planFor('@nobody fix the login on monday high -- blank screen', PEOPLE, TODAY)
    expect(plan?.unresolvedQuery).toBe('nobody')
    expect(plan?.assignee).toBeNull()
    expect(plan?.title).toBe('fix the login')
    expect(plan?.due).toBe('2026-08-17')
    expect(plan?.dueLabel).not.toBeNull()
    expect(plan?.priority).toBe(3)
    expect(plan?.description).toBe('blank screen')
  })

  // The sibling branch, pinned so the two "name did not resolve to one person"
  // cases cannot drift apart again.
  it('keeps the same fields when the name is ambiguous', () => {
    const plan = planFor('sam fix the login on monday', PEOPLE, TODAY)
    expect(plan?.ambiguousNames).toEqual(['Sam Perera', 'Sam Fernando'])
    expect(plan?.title).toBe('fix the login')
    expect(plan?.due).toBe('2026-08-17')
  })

  it('puts an unresolved "on <app>" hint back into the title', () => {
    const plan = planFor('fix the login on billing', PEOPLE, TODAY)
    expect(plan?.title).toBe('fix the login on billing')
  })

  it('captures a phrase the parser refuses verbatim', () => {
    const plan = planFor('hi', PEOPLE, TODAY)
    expect(plan?.title).toBe('hi')
    expect(plan?.assignee).toBeNull()
  })

  it('is null for an empty draft', () => {
    expect(planFor('   ', PEOPLE, TODAY)).toBeNull()
  })
})
