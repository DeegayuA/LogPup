import { describe, expect, it } from 'vitest'
import { childToggleTarget, withStatusOverrides } from './child-toggle'

describe('childToggleTarget', () => {
  it('ticks any open status to done', () => {
    expect(childToggleTarget('todo')).toBe('done')
    expect(childToggleTarget('in_progress')).toBe('done')
    expect(childToggleTarget('qa_failed')).toBe('done')
  })

  it('unticks done back to todo', () => {
    expect(childToggleTarget('done')).toBe('todo')
  })
})

describe('withStatusOverrides', () => {
  const items = [
    { id: 'a', status: 'todo' as const, title: 'A' },
    { id: 'b', status: 'in_progress' as const, title: 'B' },
  ]

  it('applies a tick to its child only', () => {
    const shown = withStatusOverrides(items, { a: 'done' })
    expect(shown.map((c) => c.status)).toEqual(['done', 'in_progress'])
    expect(shown[0].title).toBe('A')
  })

  it('leaves the list untouched with no overrides', () => {
    expect(withStatusOverrides(items, {})).toEqual(items)
  })
})
