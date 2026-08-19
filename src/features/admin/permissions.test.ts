import { it, expect } from 'vitest'
import { canEditUser, wouldLeaveNoSuperadmins } from './permissions'

it('same id (self) → false', () => expect(canEditUser('u1', 'u1')).toBe(false))
it('different id → true', () => expect(canEditUser('u1', 'u2')).toBe(true))

it('zero other active superadmins → would leave none', () => expect(wouldLeaveNoSuperadmins(0)).toBe(true))
it('one or more other active superadmins → safe', () => expect(wouldLeaveNoSuperadmins(1)).toBe(false))
