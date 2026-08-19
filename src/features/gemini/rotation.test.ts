import { describe, expect, it } from 'vitest'
import { orderKeysForRotation } from '@/features/gemini/rotation'

const key = (userId: string, shared: boolean, lastUsedAt: Date | null, id: string) => ({
  id,
  userId,
  shared,
  lastUsedAt,
})

describe('orderKeysForRotation', () => {
  it('puts own keys first (LRU, never-used before used), then shared keys LRU', () => {
    const rows = [
      key('me', false, new Date('2026-08-18'), 'own-used'),
      key('other', true, null, 'shared-fresh'),
      key('me', false, null, 'own-fresh'),
      key('other', true, new Date('2026-08-01'), 'shared-old'),
    ]
    expect(orderKeysForRotation('me', rows).map((k) => k.id)).toEqual([
      'own-fresh',
      'own-used',
      'shared-fresh',
      'shared-old',
    ])
  })

  it('drops another user’s unshared key even if the query leaked it', () => {
    const rows = [key('other', false, null, 'private-leak'), key('me', false, null, 'own')]
    expect(orderKeysForRotation('me', rows).map((k) => k.id)).toEqual(['own'])
  })

  it('own shared key counts as own, not as pool', () => {
    const rows = [
      key('other', true, null, 'pool'),
      key('me', true, new Date('2026-08-18'), 'own-shared'),
    ]
    expect(orderKeysForRotation('me', rows).map((k) => k.id)).toEqual(['own-shared', 'pool'])
  })
})
