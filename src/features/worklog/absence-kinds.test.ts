import { describe, expect, it } from 'vitest'
import { absenceKind } from '@/db/schema'
import {
  ABSENCE_KIND_DEFINITIONS,
  ABSENCE_KIND_LABELS,
  ABSENCE_KIND_PHRASES,
  SELF_DECLARABLE_KINDS,
  absenceKindLabel,
  exemptingAbsences,
  exemptsWholeDay,
  selfDeclarableGroups,
} from '@/features/worklog/absence-kinds'

describe('the kind list mirrors the column', () => {
  /* THE ONE TEST THAT MATTERS. A kind in this module but not in the pg enum is
     a picker option that fails on insert; a kind in the enum but not here is a
     filed absence that renders as a raw identifier. */
  it('covers exactly the values absence_kind can hold', () => {
    expect([...ABSENCE_KIND_DEFINITIONS.map((k) => k.id)].sort()).toEqual(
      [...absenceKind.enumValues].sort(),
    )
  })

  it('gives every kind a label', () => {
    for (const kind of absenceKind.enumValues) {
      expect(ABSENCE_KIND_LABELS[kind]).toBeTruthy()
    }
  })

  it('reads an unknown kind back as itself rather than undefined', () => {
    expect(absenceKindLabel('sabbatical_2031')).toBe('sabbatical_2031')
  })
})

describe('what a person may declare about themselves', () => {
  it('excludes the two an admin files for you', () => {
    expect(SELF_DECLARABLE_KINDS).not.toContain('no_work_assigned')
    expect(SELF_DECLARABLE_KINDS).not.toContain('other')
  })

  it('offers the statutory three, the part-day two and duty leave', () => {
    for (const kind of ['annual', 'casual', 'sick', 'half_day', 'short_leave', 'duty'] as const) {
      expect(SELF_DECLARABLE_KINDS).toContain(kind)
    }
  })

  it('groups them without losing any', () => {
    const grouped = selfDeclarableGroups().flatMap((entry) => entry.kinds.map((k) => k.id))
    expect(grouped).toEqual([...SELF_DECLARABLE_KINDS])
  })

  it('never puts a self-declarable kind under "Filed for you"', () => {
    for (const entry of selfDeclarableGroups()) {
      expect(entry.group).not.toBe('Filed for you')
    }
  })
})

describe('part-day kinds do not write off a day', () => {
  it('refuses a whole-day exemption for a half day and a short leave', () => {
    expect(exemptsWholeDay('half_day')).toBe(false)
    expect(exemptsWholeDay('short_leave')).toBe(false)
  })

  it('exempts the whole day for everything else', () => {
    for (const kind of absenceKind.enumValues) {
      if (kind === 'half_day' || kind === 'short_leave') continue
      expect(exemptsWholeDay(kind)).toBe(true)
    }
  })

  it('treats an unknown kind as exempting nothing', () => {
    expect(exemptsWholeDay('sabbatical_2031')).toBe(false)
  })

  /* The regression this filter exists for: an APPROVED half day reaching
     absenceDays() would remove the whole day from the denominator, so two
     hours at the dentist would silently clear a day off the ledger, the
     calendar, the streak and /intel at once. */
  it('drops part-day rows before they reach a coverage denominator', () => {
    const rows = [
      { kind: 'annual', startDate: '2026-09-01', endDate: '2026-09-01' },
      { kind: 'half_day', startDate: '2026-09-02', endDate: '2026-09-02' },
      { kind: 'short_leave', startDate: '2026-09-03', endDate: '2026-09-03' },
      { kind: 'casual', startDate: '2026-09-04', endDate: '2026-09-04' },
    ]
    expect(exemptingAbsences(rows).map((row) => row.kind)).toEqual(['annual', 'casual'])
  })

  it('keeps the array untouched when nothing is part-day', () => {
    const rows = [{ kind: 'sick', startDate: '2026-09-01', endDate: '2026-09-02' }]
    expect(exemptingAbsences(rows)).toEqual(rows)
  })
})

describe('the phrases the free-text reader matches', () => {
  it('gives every self-declarable kind at least one spelling', () => {
    for (const kind of SELF_DECLARABLE_KINDS) {
      expect(ABSENCE_KIND_PHRASES[kind].length).toBeGreaterThan(0)
    }
  })

  /* Bare "off" and bare "leave" would turn "off to the client site" and
     "leave the migration to me" into a leave request addressed to somebody's
     manager. Anything this vague belongs in the picker, not in the reader. */
  it('never matches on a word too vague to mean one thing', () => {
    const all = Object.values(ABSENCE_KIND_PHRASES).flat()
    expect(all).not.toContain('off')
    expect(all).not.toContain('leave')
    expect(all).not.toContain('out')
  })
})
