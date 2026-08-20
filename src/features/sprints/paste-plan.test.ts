import { describe, expect, it } from 'vitest'
import {
  MAX_PASTE_TASKS,
  isBulkPaste,
  resolveAssigneeName,
  splitPasteLocally,
} from '@/features/sprints/paste-plan'
import type { IntentPerson } from '@/lib/task-intent'

const people: IntentPerson[] = [
  { id: 'u-shanika', name: 'Shanika Perera' },
  { id: 'u-sam', name: 'Sam Silva' },
  { id: 'u-samadhi', name: 'Samadhi Fernando' },
]

// A fixed Wednesday so relative dates in pasted lines are deterministic.
const today = new Date('2026-08-19T12:00:00+05:30')

describe('isBulkPaste', () => {
  it('is true for two or more non-empty lines', () => {
    expect(isBulkPaste('fix login\nupdate docs')).toBe(true)
    expect(isBulkPaste('fix login\n\n\nupdate docs\n')).toBe(true)
  })

  it('is false for a short single line', () => {
    expect(isBulkPaste('fix login')).toBe(false)
    expect(isBulkPaste('   fix login   ')).toBe(false)
  })

  it('is true for a paragraph-sized single line', () => {
    expect(isBulkPaste('we decided that '.repeat(20))).toBe(true)
  })
})

describe('splitPasteLocally', () => {
  it('makes one draft per non-empty line, stripping list markers', () => {
    const drafts = splitPasteLocally('- fix login\n* update docs\n3. ship it\n• test all', people, today)
    expect(drafts.map((d) => d.title)).toEqual(['fix login', 'update docs', 'ship it', 'test all'])
  })

  it('reads names, priority and dates through the composer parser', () => {
    const [draft] = splitPasteLocally('fix login @shanika high', people, today)
    expect(draft.assigneeId).toBe('u-shanika')
    expect(draft.assigneeName).toBe('Shanika Perera')
    expect(draft.priority).toBeGreaterThan(0)
  })

  it('keeps an unresolved name for the panel to flag instead of dropping it', () => {
    const [draft] = splitPasteLocally('fix login @nadia', people, today)
    expect(draft.assigneeId).toBeNull()
    expect(draft.assigneeName).toBe('nadia')
  })

  it('keeps only the first assignee of a multi-name line (no silent fan-out)', () => {
    const [draft] = splitPasteLocally('fix login @shanika @sam', people, today)
    expect(draft.assigneeId).toBe('u-shanika')
  })

  it('caps the drafts at MAX_PASTE_TASKS', () => {
    const text = Array.from({ length: MAX_PASTE_TASKS + 10 }, (_, i) => `task ${i + 1}`).join('\n')
    expect(splitPasteLocally(text, people, today)).toHaveLength(MAX_PASTE_TASKS)
  })

  it('skips blank lines rather than drafting empty tasks', () => {
    expect(splitPasteLocally('fix login\n\n   \nupdate docs', people, today)).toHaveLength(2)
  })
})

describe('resolveAssigneeName', () => {
  it('matches a full name case-insensitively', () => {
    expect(resolveAssigneeName('shanika perera', people)).toEqual({
      id: 'u-shanika',
      matched: true,
    })
  })

  it('accepts a unique prefix', () => {
    expect(resolveAssigneeName('shan', people)).toEqual({ id: 'u-shanika', matched: true })
  })

  it('refuses an ambiguous prefix instead of guessing', () => {
    // "sam" prefixes both Sam Silva and Samadhi Fernando.
    expect(resolveAssigneeName('sam', people)).toEqual({ id: null, matched: false })
  })

  it('treats an exact full name as unambiguous even when it prefixes another', () => {
    expect(resolveAssigneeName('Sam Silva', people)).toEqual({ id: 'u-sam', matched: true })
  })

  it('reports an unknown name as unmatched', () => {
    expect(resolveAssigneeName('nadia', people)).toEqual({ id: null, matched: false })
  })

  it('treats no name as nothing to match', () => {
    expect(resolveAssigneeName(null, people)).toEqual({ id: null, matched: true })
    expect(resolveAssigneeName('   ', people)).toEqual({ id: null, matched: true })
  })
})
