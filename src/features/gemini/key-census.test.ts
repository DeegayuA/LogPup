import { describe, expect, it } from 'vitest'
import { creditLine, keyCensus, type KeyOwnership } from './key-census'

const key = (over: Partial<KeyOwnership> = {}): KeyOwnership => ({
  userId: 'u1',
  userName: 'Ishara',
  shared: false,
  active: true,
  ...over,
})

describe('the census an admin asks for', () => {
  it('counts every key, and splits shared from private', () => {
    const census = keyCensus([
      key({ userId: 'u1', userName: 'Ishara', shared: true }),
      key({ userId: 'u1', userName: 'Ishara', shared: false }),
      key({ userId: 'u2', userName: 'Nuwan', shared: true }),
    ])
    expect(census.totalKeys).toBe(3)
    expect(census.sharedKeys).toBe(2)
    expect(census.privateKeys).toBe(1)
  })

  it('breaks it down per person, most keys first', () => {
    const census = keyCensus([
      key({ userId: 'u2', userName: 'Nuwan', shared: true }),
      key({ userId: 'u1', userName: 'Ishara', shared: true }),
      key({ userId: 'u1', userName: 'Ishara', shared: false }),
    ])
    expect(census.people.map((p) => p.userName)).toEqual(['Ishara', 'Nuwan'])
    expect(census.people[0]).toMatchObject({ total: 2, shared: 1, private: 1 })
    expect(census.people[1]).toMatchObject({ total: 1, shared: 1, private: 0 })
  })

  it('counts a deactivated key on the books', () => {
    // An admin asking "how many keys are in the system" is asking about the
    // books, not the live pool: a switched-off key is still a key someone
    // holds and can switch back on.
    const census = keyCensus([key({ shared: true, active: false })])
    expect(census.totalKeys).toBe(1)
    expect(census.people[0].total).toBe(1)
  })

  it('is empty rather than broken when nobody has a key', () => {
    const census = keyCensus([])
    expect(census).toMatchObject({ totalKeys: 0, sharedKeys: 0, privateKeys: 0 })
    expect(census.people).toEqual([])
    expect(census.contributors).toEqual([])
  })
})

describe('who gets credited', () => {
  it('names people whose shared key is live', () => {
    const census = keyCensus([
      key({ userId: 'u2', userName: 'Nuwan', shared: true }),
      key({ userId: 'u1', userName: 'Ishara', shared: true }),
    ])
    expect(census.contributors).toEqual(['Ishara', 'Nuwan'])
  })

  it('never credits somebody for a key they kept private', () => {
    // The privacy line this module exists to hold: a private key is counted
    // for the admin, and its owner is not thanked in public for it.
    const census = keyCensus([key({ userName: 'Ishara', shared: false })])
    expect(census.privateKeys).toBe(1)
    expect(census.contributors).toEqual([])
  })

  it('does not credit a switched-off shared key', () => {
    // Opposite rule to the census on purpose: this line thanks people for
    // requests being carried NOW, and a deactivated key carries none.
    const census = keyCensus([key({ userName: 'Nuwan', shared: true, active: false })])
    expect(census.sharedKeys).toBe(1)
    expect(census.contributors).toEqual([])
  })

  it('thanks a person once however many keys they shared', () => {
    const census = keyCensus([
      key({ userId: 'u1', userName: 'Ishara', shared: true }),
      key({ userId: 'u1', userName: 'Ishara', shared: true }),
      key({ userId: 'u1', userName: 'Ishara', shared: true }),
    ])
    expect(census.contributors).toEqual(['Ishara'])
  })
})

describe('the credit line', () => {
  it('renders nothing when nobody has shared', () => {
    // There is no graceful way to thank zero people, so the caller renders
    // nothing rather than an empty flourish.
    expect(creditLine([])).toBeNull()
  })

  it('names one, two and three in full', () => {
    expect(creditLine(['Ishara'])).toBe('Shared by Ishara')
    expect(creditLine(['Ishara', 'Nuwan'])).toBe('Shared by Ishara and Nuwan')
    expect(creditLine(['Ishara', 'Nuwan', 'Kavindu'])).toBe('Shared by Ishara, Nuwan and Kavindu')
  })

  it('stops at two names once a list would start wrapping', () => {
    expect(creditLine(['Ishara', 'Nuwan', 'Kavindu', 'Dilan'])).toBe(
      'Shared by Ishara, Nuwan and 2 others',
    )
  })
})
