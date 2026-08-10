import { it, expect } from 'vitest'
import { canMoveTask } from './permissions'

it('admin moves anything', () => expect(canMoveTask('admin', 'u1', 'u2')).toBe(true))
it('member moves own', () => expect(canMoveTask('member', 'u1', 'u1')).toBe(true))
it('member blocked on others', () => expect(canMoveTask('member', 'u1', 'u2')).toBe(false))
it('member blocked on unassigned', () => expect(canMoveTask('member', 'u1', null)).toBe(false))
