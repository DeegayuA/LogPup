import { describe, expect, it } from 'vitest'

import { toCsv } from '@/features/admin/bulk-logic'
import {
  TEAM_CSV_HEADERS,
  employmentLabel,
  projectPosition,
  teamCsvPrefix,
  teamCsvRows,
  type TeamCsvMember,
} from './team-csv'

const NOBODY = { pmUserId: null, leadUserId: null }

const AMA: TeamCsvMember = {
  userId: 'user-ama',
  name: 'Ama Perera',
  email: 'ama@altavision.lk',
  role: 'Frontend',
  allocationPct: 60,
  employmentType: 'permanent',
}

const NUWAN: TeamCsvMember = {
  userId: 'user-nuwan',
  name: 'Nuwan Silva',
  email: 'nuwan@altavision.lk',
  role: 'Backend',
  allocationPct: 40,
  employmentType: 'contract',
}

describe('what the roster may contain', () => {
  it('names no column this file has no business writing out', () => {
    // The guard that matters. A private address or a phone number added to
    // TeamMember upstream must not silently start appearing in a file people
    // forward — and the input type has no field for either, so this is a
    // second lock on the same door rather than the only one.
    expect(TEAM_CSV_HEADERS).not.toContain('personal_email')
    expect(TEAM_CSV_HEADERS).not.toContain('phone')
  })

  it('carries the name and the work address, which is the whole ask', () => {
    expect(TEAM_CSV_HEADERS).toContain('name')
    expect(TEAM_CSV_HEADERS).toContain('email')
  })

  it('writes one row per member, in the order given', () => {
    expect(teamCsvRows([AMA, NUWAN], NOBODY)).toEqual([
      ['Ama Perera', 'ama@altavision.lk', 'Frontend', 60, '', 'Permanent'],
      ['Nuwan Silva', 'nuwan@altavision.lk', 'Backend', 40, '', 'Contract'],
    ])
  })

  it('keeps the allocation a number, so the column can be totalled', () => {
    const [row] = teamCsvRows([AMA], NOBODY)
    expect(row?.[3]).toBe(60)
    expect(typeof row?.[3]).toBe('number')
  })

  it('has a cell for every header', () => {
    for (const row of teamCsvRows([AMA, NUWAN], NOBODY)) {
      expect(row).toHaveLength(TEAM_CSV_HEADERS.length)
    }
  })
})

describe('projectPosition', () => {
  it('says PM, tech lead, or both', () => {
    expect(projectPosition('user-ama', { pmUserId: 'user-ama', leadUserId: null })).toBe('PM')
    expect(projectPosition('user-ama', { pmUserId: null, leadUserId: 'user-ama' })).toBe(
      'Tech lead',
    )
    // One person holding the plan and the code is ordinary on a small project.
    // Picking one of the two would be wrong about who to go to for the other.
    expect(projectPosition('user-ama', { pmUserId: 'user-ama', leadUserId: 'user-ama' })).toBe(
      'PM & tech lead',
    )
  })

  it('is empty for somebody who holds neither', () => {
    expect(projectPosition('user-nuwan', { pmUserId: 'user-ama', leadUserId: null })).toBe('')
    expect(projectPosition('user-ama', NOBODY)).toBe('')
  })

  it('does not invent a row for a position holder who is not on the team', () => {
    // Positions live on app_role_history, allocations on assignments — a PM
    // can hold the project while carrying none of it. The roster is the
    // assignment list, so they are simply absent.
    const rows = teamCsvRows([NUWAN], { pmUserId: 'user-ama', leadUserId: null })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.[0]).toBe('Nuwan Silva')
  })
})

describe('employmentLabel', () => {
  it('reads as a category rather than as a database value', () => {
    expect(employmentLabel('permanent')).toBe('Permanent')
    expect(employmentLabel('probation')).toBe('Probation')
    expect(employmentLabel('trainee')).toBe('Trainee')
  })

  it('is empty when nobody has set one', () => {
    expect(employmentLabel(null)).toBe('')
    expect(employmentLabel('')).toBe('')
  })
})

describe('the file itself', () => {
  it('is named for the project it came from', () => {
    expect(teamCsvPrefix('logpup')).toBe('logpup-team')
  })

  it('survives a name with a comma in it', () => {
    // toCsv owns the quoting; this asserts the roster actually goes through it
    // rather than joining cells by hand somewhere.
    const withComma: TeamCsvMember = { ...AMA, name: 'Perera, Ama' }
    const csv = toCsv(TEAM_CSV_HEADERS, teamCsvRows([withComma], NOBODY))
    expect(csv.split('\r\n')[1]).toBe('"Perera, Ama",ama@altavision.lk,Frontend,60,,Permanent')
  })

  it('defuses a role somebody typed as a formula', () => {
    // csvCell's guard: a cell opening with = + - @ executes when the file is
    // opened, and `assignments.role` is free text like any other user input.
    const attack: TeamCsvMember = { ...AMA, role: '=HYPERLINK("http://evil.example")' }
    const csv = toCsv(TEAM_CSV_HEADERS, teamCsvRows([attack], NOBODY))
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"")"`)
  })
})
