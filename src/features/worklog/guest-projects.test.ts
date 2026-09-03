import { describe, expect, it } from 'vitest'

import { partitionGuestApps } from '@/features/worklog/guest-projects'

const guests = [
  { id: 'a', name: 'EV Charging App' },
  { id: 'b', name: 'DERMS Web App' },
  { id: 'c', name: 'SCADA | CEB Assist' },
]

describe('partitionGuestApps', () => {
  it('keeps every guest available when the note tags none of them', () => {
    const { tagged, available } = partitionGuestApps('shipped the invoice export', guests)
    expect(tagged).toEqual([])
    expect(available).toEqual(guests)
  })

  it('moves a tagged guest into the chip half and keeps the rest pickable', () => {
    const { tagged, available } = partitionGuestApps(
      'unblocked their OCPP handshake\n[EV Charging App] ',
      guests,
    )
    expect(tagged.map((app) => app.id)).toEqual(['a'])
    expect(available.map((app) => app.id)).toEqual(['b', 'c'])
  })

  it('matches tags case-insensitively, the same rule the assigned chips read', () => {
    const { tagged } = partitionGuestApps('[ev charging app] ', guests)
    expect(tagged.map((app) => app.id)).toEqual(['a'])
  })

  it('does not count a bare name in prose as tagged — only the bracketed tag form', () => {
    const { tagged, available } = partitionGuestApps(
      'paired on the EV Charging App rate limiter',
      guests,
    )
    expect(tagged).toEqual([])
    expect(available.map((app) => app.id)).toEqual(['a', 'b', 'c'])
  })

  it('handles names carrying regex metacharacters as plain text', () => {
    const { tagged } = partitionGuestApps('[SCADA | CEB Assist] ', guests)
    expect(tagged.map((app) => app.id)).toEqual(['c'])
  })

  it('preserves picker order within each half', () => {
    const { tagged, available } = partitionGuestApps('[DERMS Web App] [EV Charging App] ', guests)
    // Order follows the guest list (sorted by name upstream), not tag order in
    // the note — the row must not reshuffle as tags are typed.
    expect(tagged.map((app) => app.id)).toEqual(['a', 'b'])
    expect(available.map((app) => app.id)).toEqual(['c'])
  })
})
