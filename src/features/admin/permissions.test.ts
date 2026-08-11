import { it, expect } from 'vitest'
import { canEditUser, wouldLeaveNoAdmins } from './permissions'

it('same id (self) → false', () => expect(canEditUser('u1', 'u1')).toBe(false))
it('different id → true', () => expect(canEditUser('u1', 'u2')).toBe(true))

it('zero other active admins → would leave none', () => expect(wouldLeaveNoAdmins(0)).toBe(true))
it('one or more other active admins → safe', () => expect(wouldLeaveNoAdmins(1)).toBe(false))
