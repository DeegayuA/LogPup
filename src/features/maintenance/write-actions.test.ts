import { describe, it, expect } from 'vitest'
import { ROLE_GRANTS, type Action } from '@/features/auth/capabilities'
import {
  MAINTENANCE_ALLOWED_WRITES,
  actionsAllowedDuringMaintenance,
  isFrozenByMaintenance,
} from './write-actions'

describe('what a maintenance freeze stops', () => {
  it('lets every read through, so the screens explaining the window still render', () => {
    // 'view' as a whole DOT-SEPARATED SEGMENT, not as a substring. `a.includes('view')`
    // matches 'request.review', which is a sign-off — the write this whole
    // freeze exists to stop — and it is the reason the classifier anchors on
    // segments rather than on text.
    const reads = (Object.keys(ROLE_GRANTS) as Action[]).filter((a) => a.split('.').includes('view'))
    expect(reads.length).toBeGreaterThan(5)
    for (const action of reads) expect(isFrozenByMaintenance(action), action).toBe(false)
  })

  it('freezes request.review, which merely looks like a read', () => {
    expect(isFrozenByMaintenance('request.review')).toBe(true)
    expect(isFrozenByMaintenance('request.review.self')).toBe(true)
  })

  it('stops the writes', () => {
    for (const action of ['task.create', 'meeting.delete', 'worklog.write.own', 'user.approve'] as Action[]) {
      expect(isFrozenByMaintenance(action), action).toBe(true)
    }
  })

  // The backup is the thing you take BEFORE the window. A freeze that blocks it
  // blocks the one action a window is the reason for.
  it('lets a backup through, because a window is why you are taking one', () => {
    expect(isFrozenByMaintenance('danger.backup.export')).toBe(false)
  })

  // Allowlist hygiene, the same rule registry.test.ts applies: an exemption
  // naming an action that no longer exists is an exemption nobody can audit.
  it('never names an action that does not exist', () => {
    for (const action of MAINTENANCE_ALLOWED_WRITES) {
      expect(ROLE_GRANTS[action], action).toBeDefined()
    }
  })

  it('freezes the clear majority of the matrix — an exemption list is not a second matrix', () => {
    const allowed = actionsAllowedDuringMaintenance()
    const total = Object.keys(ROLE_GRANTS).length
    expect(allowed.length).toBeLessThan(total / 2)
  })
})
