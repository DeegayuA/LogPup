import { it, expect } from 'vitest'
import { canEditUser } from './permissions'

it('same id (self) → false', () => expect(canEditUser('u1', 'u1')).toBe(false))
it('different id → true', () => expect(canEditUser('u1', 'u2')).toBe(true))
