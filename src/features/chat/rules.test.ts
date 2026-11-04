import { describe, expect, it } from 'vitest'
import {
  channelPermissions,
  fileMessageBody,
  groupTitle,
  laterOf,
  mentionTargets,
  nextRejectCount,
  pollGaveUp,
  pollSince,
  POLL_OVERLAP_MS,
  POLL_REJECT_LIMIT,
  unreadBadgeLabel,
  unreadBadgeText,
  uploadLimitError,
  UPLOAD_LIMIT_PER_HOUR,
  withParams,
  type ChannelFacts,
} from './rules'

const base: ChannelFacts = {
  kind: 'public',
  archived: false,
  isMember: false,
  isOwner: false,
  canView: false,
  canComment: false,
  canManage: false,
}

describe('channelPermissions', () => {
  it('public: read on app.view, write on task.comment, no member list', () => {
    expect(channelPermissions({ ...base, canView: true })).toEqual({ read: true, write: false, addMembers: false, moderate: false })
    expect(channelPermissions({ ...base, canView: true, canComment: true }).write).toBe(true)
    expect(channelPermissions({ ...base, canComment: true }).read).toBe(false)
    expect(channelPermissions({ ...base, canView: true, canManage: true }).moderate).toBe(true)
  })

  it('private: members only, and only while they can still see the project', () => {
    const member = { ...base, kind: 'private' as const, isMember: true, canView: true, canComment: true }
    expect(channelPermissions(member)).toMatchObject({ read: true, write: true, addMembers: false })
    expect(channelPermissions({ ...member, canView: false }).read).toBe(false)
    expect(channelPermissions({ ...member, isMember: false }).read).toBe(false)
    expect(channelPermissions({ ...member, isOwner: true }).addMembers).toBe(true)
    // A manager may add people without being in the channel, but not read it.
    const manager = { ...base, kind: 'private' as const, canView: true, canManage: true }
    expect(channelPermissions(manager)).toMatchObject({ read: false, addMembers: true })
  })

  it('context: like public', () => {
    expect(channelPermissions({ ...base, kind: 'context', canView: true, canComment: true })).toMatchObject({ read: true, write: true })
  })

  it('dm and group: membership is the whole rule', () => {
    expect(channelPermissions({ ...base, kind: 'dm', isMember: true })).toEqual({ read: true, write: true, addMembers: false, moderate: false })
    expect(channelPermissions({ ...base, kind: 'dm', canView: true, canManage: true }).read).toBe(false)
    expect(channelPermissions({ ...base, kind: 'group', isMember: true }).addMembers).toBe(true)
  })

  it('archived conversations are read-only', () => {
    const p = channelPermissions({ ...base, kind: 'group', isMember: true, archived: true })
    expect(p).toMatchObject({ read: true, write: false, addMembers: false })
  })
})

describe('pollSince', () => {
  const now = new Date('2026-11-03T10:00:00Z')
  it('steps back by the overlap', () => {
    expect(pollSince('2026-11-03T09:59:00Z', now)?.getTime()).toBe(new Date('2026-11-03T09:59:00Z').getTime() - POLL_OVERLAP_MS)
  })
  it('clamps the future to now and the far past to an hour', () => {
    expect(pollSince('2030-01-01T00:00:00Z', now)?.getTime()).toBe(now.getTime() - POLL_OVERLAP_MS)
    expect(pollSince('2020-01-01T00:00:00Z', now)?.getTime()).toBe(now.getTime() - 3_600_000 - POLL_OVERLAP_MS)
  })
  it('refuses garbage', () => {
    expect(pollSince('nope', now)).toBeNull()
  })
})

describe('small helpers', () => {
  it('laterOf never moves backwards', () => {
    const a = new Date(1000)
    const b = new Date(2000)
    expect(laterOf(a, b)).toBe(b)
    expect(laterOf(b, a)).toBe(b)
  })
  it('groupTitle', () => {
    expect(groupTitle([])).toBe('Group')
    expect(groupTitle(['Ann'])).toBe('Ann')
    expect(groupTitle(['Ann', 'Bo'])).toBe('Ann and Bo')
    expect(groupTitle(['Ann', 'Bo', 'Cy'])).toBe('Ann, Bo and Cy')
    expect(groupTitle(['Ann', 'Bo', 'Cy', 'Di'])).toBe('Ann, Bo, Cy and 1 other')
    expect(groupTitle(['Ann', 'Bo', 'Cy', 'Di', 'Ed'])).toBe('Ann, Bo, Cy and 2 others')
  })
  it('fileMessageBody strips link-breaking characters', () => {
    expect(fileMessageBody('abc', 'shot (1).png', true)).toBe('![shot 1.png](/api/attachments/abc)')
    expect(fileMessageBody('abc', 'spec[v2].pdf', false)).toBe('📎 [specv2.pdf](/api/attachments/abc)')
  })
})

describe('withParams', () => {
  it('adds, replaces and drops params on either base shape', () => {
    expect(withParams('/chat', { c: 'a' })).toBe('/chat?c=a')
    expect(withParams('/apps/x?tab=chat', { c: 'a', t: null })).toBe('/apps/x?tab=chat&c=a')
    expect(withParams('/chat?c=a&t=b', { t: null })).toBe('/chat?c=a')
    expect(withParams('/chat?c=a', { c: null })).toBe('/chat')
  })
})

describe('poll rejection run', () => {
  it('counts consecutive refusals and resets on success', () => {
    let n = 0
    n = nextRejectCount(n, false)
    n = nextRejectCount(n, false)
    expect(pollGaveUp(n)).toBe(false)
    n = nextRejectCount(n, true)
    expect(n).toBe(0)
    for (let i = 0; i < POLL_REJECT_LIMIT; i++) n = nextRejectCount(n, false)
    expect(n).toBe(3)
    expect(pollGaveUp(n)).toBe(true)
  })
})

describe('uploadLimitError', () => {
  it('allows up to the hourly cap and refuses at it with a clear message', () => {
    expect(uploadLimitError(0)).toBeNull()
    expect(uploadLimitError(UPLOAD_LIMIT_PER_HOUR - 1)).toBeNull()
    expect(uploadLimitError(UPLOAD_LIMIT_PER_HOUR)).toMatch(/up to 20 files an hour/)
    expect(uploadLimitError(UPLOAD_LIMIT_PER_HOUR + 5)).not.toBeNull()
  })
})

describe('unread badge', () => {
  it('hides at 0, caps the digit at 99+, and labels the real number', () => {
    expect(unreadBadgeText(0)).toBe('0')
    expect(unreadBadgeText(-2)).toBe('0')
    expect(unreadBadgeText(3)).toBe('3')
    expect(unreadBadgeText(99)).toBe('99')
    expect(unreadBadgeText(100)).toBe('99+')
    expect(unreadBadgeLabel(0)).toBe('No unread messages')
    expect(unreadBadgeLabel(1)).toBe('1 unread message')
    expect(unreadBadgeLabel(3)).toBe('3 unread messages')
    expect(unreadBadgeLabel(250)).toBe('250 unread messages')
  })
})

describe('mentionTargets', () => {
  it('drops the author and dedupes', () => {
    expect(mentionTargets({ mentioned: ['a', 'me', 'a', 'b'], actorId: 'me' })).toEqual(['a', 'b'])
  })
  it('on an edit, skips names the previous body had and people already notified for this message', () => {
    expect(
      mentionTargets({ mentioned: ['a', 'b', 'c'], actorId: 'me', previouslyMentioned: ['a'], alreadyNotified: ['b'] }),
    ).toEqual(['c'])
  })
})
