import { describe, expect, it } from 'vitest'
import {
  ATTENDEE_GROUP_HEADING,
  DEFAULT_UNASSIGNED_LABEL,
  UNASSIGNED_VALUE,
  UNKNOWN_PERSON_LABEL,
  buildPeopleOptions,
  buildPeoplePool,
  fromPickerValue,
  groupPeopleOptions,
  matchesPersonQuery,
  personInitial,
  resolveChipLabels,
  resolveListState,
  resolveTriggerLabel,
  toPickerValue,
  toggleSelection,
} from './meeting-people-picker-model'

const HASITH = { id: 'u-hasith', name: 'Hasith Heshika' }
const GOBIRAJ = { id: 'u-gobiraj', name: 'Gobiraj' }
/** Named in the write-up, not in the room — the case that must stay assignable. */
const RAHUMAT = { id: 'u-rahumat', name: 'Rahumat' }

describe('the unassigned sentinel', () => {
  it('is the literal already persisted by the board', () => {
    // action-item-board.tsx re-exports THIS constant rather than declaring its
    // own, so the two cannot drift — but the literal itself is now load-bearing
    // for data already in the column, so changing it is a migration, not a
    // rename. Pinned here to make that obvious to whoever tries.
    expect(UNASSIGNED_VALUE).toBe('__unassigned__')
  })

  it('round-trips null through the control and back', () => {
    expect(toPickerValue(null)).toBe(UNASSIGNED_VALUE)
    expect(fromPickerValue(UNASSIGNED_VALUE)).toBeNull()
    expect(fromPickerValue(toPickerValue(null))).toBeNull()
    expect(fromPickerValue(toPickerValue('u-hasith'))).toBe('u-hasith')
  })
})

describe('who is offered, and in what order', () => {
  it('puts meeting attendees before everyone else', () => {
    const options = buildPeopleOptions({ attendees: [HASITH], people: [GOBIRAJ, RAHUMAT] })

    expect(options.map((o) => o.value)).toEqual(['u-hasith', 'u-gobiraj', 'u-rahumat'])
    expect(options[0].group).toBe('attendee')
    expect(options[1].group).toBe('workspace')
  })

  it('offers someone who is both an attendee and in the workspace list exactly once', () => {
    const options = buildPeopleOptions({ attendees: [HASITH], people: [HASITH, GOBIRAJ] })

    expect(options.filter((o) => o.value === 'u-hasith')).toHaveLength(1)
    expect(options[0].group).toBe('attendee')
  })

  it('collapses a duplicated attendee row', () => {
    // A re-invite or a merged account can put the same user on a meeting
    // twice. buildAssigneePool never deduped WITHIN a list, so the picker
    // showed the same person twice with no way to tell the rows apart.
    const options = buildPeopleOptions({ attendees: [HASITH, HASITH] })

    expect(options).toHaveLength(1)
  })

  it('does not block a non-attendee', () => {
    // The product decision this whole picker rests on. The meeting AI writes
    // "Coordinate subdomain creation with Rahumat" for someone who was not in
    // the room; refusing to offer them makes that task unassignable to the
    // one person it names.
    const options = buildPeopleOptions({ attendees: [HASITH], people: [RAHUMAT] })

    expect(options.map((o) => o.value)).toContain('u-rahumat')
    expect(options.find((o) => o.value === 'u-rahumat')?.disabled).toBeFalsy()
  })

  it('keeps an already-selected person offerable even when both lists have lost them', () => {
    const options = buildPeopleOptions({ attendees: [HASITH], selected: [RAHUMAT] })

    expect(options.map((o) => o.value)).toContain('u-rahumat')
    // Not invented into the meeting — they were never an attendee.
    expect(options.find((o) => o.value === 'u-rahumat')?.group).toBe('workspace')
  })

  it('never treats the sentinel as a person', () => {
    const options = buildPeopleOptions({
      attendees: [HASITH],
      selected: [{ id: UNASSIGNED_VALUE, name: 'Nobody' }],
    })

    expect(options.map((o) => o.value)).not.toContain(UNASSIGNED_VALUE)
  })

  it('drops a section with nobody in it rather than drawing an empty heading', () => {
    const groups = groupPeopleOptions(buildPeopleOptions({ attendees: [HASITH] }))

    expect(groups).toHaveLength(1)
    expect(groups[0].heading).toBe(ATTENDEE_GROUP_HEADING)
  })

  it('matches buildAssigneePool when no wider pool is supplied', () => {
    expect(buildPeoplePool([HASITH, GOBIRAJ]).map((p) => p.id)).toEqual([
      'u-hasith',
      'u-gobiraj',
    ])
  })
})

describe('the trigger never shows a uuid', () => {
  const options = buildPeopleOptions({ attendees: [HASITH], people: [RAHUMAT] })

  it('shows the name for a person in the pool', () => {
    expect(resolveTriggerLabel('u-hasith', options)).toBe('Hasith Heshika')
  })

  it('shows the name for a selected NON-attendee', () => {
    // The reported bug in the "Edit & add" dialog: its option list was built
    // from attendees alone, so a non-attendee assignee fell through to
    // "Unassigned" — the person's name silently disappeared from a task that
    // was, in fact, assigned to them.
    expect(resolveTriggerLabel('u-rahumat', options)).toBe('Rahumat')
  })

  it('falls back to a name the caller already holds when the pool has not loaded', () => {
    expect(resolveTriggerLabel('u-nadeesha', [], { fallbackName: 'Nadeesha' })).toBe('Nadeesha')
  })

  it('says someone is on it, rather than claiming nobody is, for an unnameable id', () => {
    // "Unassigned" here would be a false statement about the DATA. The row
    // has an assignee; this control just cannot name them.
    const label = resolveTriggerLabel('u-deactivated', options)

    expect(label).toBe(UNKNOWN_PERSON_LABEL)
    expect(label).not.toBe(DEFAULT_UNASSIGNED_LABEL)
    expect(label).not.toContain('u-deactivated')
  })

  it('shows the unassigned label only when there really is no assignee', () => {
    expect(resolveTriggerLabel(null, options)).toBe(DEFAULT_UNASSIGNED_LABEL)
    expect(resolveTriggerLabel(UNASSIGNED_VALUE, options)).toBe(DEFAULT_UNASSIGNED_LABEL)
  })
})

describe('multi-select', () => {
  const options = buildPeopleOptions({ attendees: [HASITH, GOBIRAJ], people: [RAHUMAT] })

  it('appends on add, so chips stay in the order they were picked', () => {
    let selected: string[] = []
    selected = toggleSelection(selected, 'u-rahumat')
    selected = toggleSelection(selected, 'u-hasith')

    expect(resolveChipLabels(selected, options).map((c) => c.label)).toEqual([
      'Rahumat',
      'Hasith Heshika',
    ])
  })

  it('removes without disturbing the order of the rest', () => {
    const selected = toggleSelection(['u-hasith', 'u-gobiraj', 'u-rahumat'], 'u-gobiraj')

    expect(selected).toEqual(['u-hasith', 'u-rahumat'])
  })

  it('renders one chip per person even if an id arrives twice', () => {
    expect(resolveChipLabels(['u-hasith', 'u-hasith'], options)).toHaveLength(1)
  })

  it('drops the sentinel rather than drawing a "Nobody" chip', () => {
    expect(resolveChipLabels([UNASSIGNED_VALUE, 'u-hasith'], options).map((c) => c.value)).toEqual([
      'u-hasith',
    ])
  })
})

describe('searching', () => {
  const [attendee] = buildPeopleOptions({ attendees: [{ ...HASITH, hint: 'QA lead' }] })

  it('matches on the name, case-insensitively', () => {
    expect(matchesPersonQuery(attendee, 'hasith')).toBe(true)
    expect(matchesPersonQuery(attendee, 'HESHIKA')).toBe(true)
  })

  it('matches on the hint, so a role finds a person', () => {
    expect(matchesPersonQuery(attendee, 'qa')).toBe(true)
  })

  it('matches on the group, so typing "meeting" finds the people in it', () => {
    expect(matchesPersonQuery(attendee, 'meeting')).toBe(true)
  })

  it('returns everything for an empty query', () => {
    expect(matchesPersonQuery(attendee, '   ')).toBe(true)
  })

  it('does not match an unrelated word', () => {
    expect(matchesPersonQuery(attendee, 'gobiraj')).toBe(false)
  })
})

describe('list states', () => {
  it('tells "still fetching" apart from "genuinely nobody"', () => {
    // An empty popup that actually means "loading" is the state bug this repo
    // keeps banning — the reader concludes there is nobody to pick.
    expect(resolveListState({ loading: true, poolSize: 0 })).toBe('loading')
    expect(resolveListState({ poolSize: 0 })).toBe('empty-pool')
    expect(resolveListState({ poolSize: 3 })).toBe('ready')
  })
})

describe('avatar initial', () => {
  it('matches what PersonInitial already renders, including the no-name case', () => {
    expect(personInitial('Hasith Heshika')).toBe('H')
    expect(personInitial('  gobiraj')).toBe('G')
    expect(personInitial(null)).toBe('?')
    expect(personInitial('   ')).toBe('?')
  })
})
