import { describe, it, expect } from 'vitest'
import { buildAssignmentNotice, shouldNotifyAssignee } from './assignment-notice'

const base = {
  taskTitle: 'Rotate the Gemini keys',
  assignerName: 'Nuwan Perera',
  appName: 'Kestrel',
  appSlug: 'kestrel',
  dueDate: null,
  dueKind: 'target' as const,
}

describe('buildAssignmentNotice', () => {
  it('leads with who assigned it, because that is what the recipient acts on', () => {
    const notice = buildAssignmentNotice(base)
    expect(notice.title).toBe('Nuwan Perera assigned you “Rotate the Gemini keys”')
    expect(notice.link).toBe('/apps/kestrel')
  })

  it('says NOTHING about a target date', () => {
    // The task row states it and the board shows it. Repeating every intention
    // here is how a notification list becomes noise.
    const notice = buildAssignmentNotice({ ...base, dueDate: '2026-08-28', dueKind: 'target' })
    expect(notice.body).toBe('Kestrel')
    expect(notice.body).not.toContain('2026-08-28')
    expect(notice.body).not.toContain('due')
  })

  it('NAMES a committed date, because that is an obligation being transferred', () => {
    // deadline.commit is an approval action: committing speaks for the studio
    // to someone who plans around it. Handing that over silently is what
    // produces "nobody told me this was promised to the client".
    const notice = buildAssignmentNotice({ ...base, dueDate: '2026-08-28', dueKind: 'committed' })
    expect(notice.body).toBe('Kestrel · committed, due 2026-08-28')
  })

  it('stays silent when a commitment somehow carries no date', () => {
    // applyDueDate should make this unreachable, but a notice that reads
    // "committed, due null" is worse than one that just names the app.
    const notice = buildAssignmentNotice({ ...base, dueDate: null, dueKind: 'committed' })
    expect(notice.body).toBe('Kestrel')
  })

  it('is factual, never urgent — no pressure words in any shape', () => {
    for (const dueKind of ['target', 'committed'] as const) {
      const notice = buildAssignmentNotice({ ...base, dueDate: '2026-08-01', dueKind })
      const text = `${notice.title} ${notice.body ?? ''}`.toLowerCase()
      for (const word of ['urgent', 'asap', 'overdue', 'late', 'immediately', '!']) {
        expect(text, `${dueKind} notice contained "${word}"`).not.toContain(word)
      }
    }
  })

  it('clips a long task title instead of letting it bury the rows beneath it', () => {
    const notice = buildAssignmentNotice({ ...base, taskTitle: 'x'.repeat(200) })
    expect(notice.title.length).toBeLessThanOrEqual(90)
    expect(notice.title.endsWith('…')).toBe(true)
  })
})

describe('shouldNotifyAssignee', () => {
  it('does not notify you about your own assignment', () => {
    expect(shouldNotifyAssignee('u1', 'u1')).toBe(false)
  })

  it('notifies when the work crosses from one person to another', () => {
    expect(shouldNotifyAssignee('u2', 'u1')).toBe(true)
  })

  it('treats an unassigned task as a backlog row, not a hand-off', () => {
    expect(shouldNotifyAssignee(null, 'u1')).toBe(false)
    expect(shouldNotifyAssignee(undefined, 'u1')).toBe(false)
    expect(shouldNotifyAssignee('', 'u1')).toBe(false)
  })
})
