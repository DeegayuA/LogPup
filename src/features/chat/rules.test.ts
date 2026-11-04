import { describe, expect, it } from 'vitest'
import {
  channelPermissions,
  clockTime,
  dayLabel,
  fileMessageBody,
  groupTitle,
  laterOf,
  mentionTargets,
  messageRuns,
  messageSnippet,
  nextRejectCount,
  pollGaveUp,
  pollSince,
  previewLine,
  relativeTime,
  SNIPPET_MAX,
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

// Wed 4 Nov 2026, 12:00 in Colombo (UTC+5:30).
const NOON = new Date('2026-11-04T06:30:00Z')

describe('messageSnippet', () => {
  it('strips Markdown marks and link targets, keeps the words', () => {
    expect(messageSnippet('**Ship** it _today_ — see [the plan](https://x.test/p) and `npm run e2e`')).toBe(
      'Ship it today — see the plan and npm run e2e',
    )
    expect(messageSnippet('# Heading\n> quoted\n- item one\n1. item two')).toBe('Heading quoted item one item two')
    expect(messageSnippet('```ts\nconst a = 1\n```\nafter')).toBe('const a = 1 after')
  })

  it('keeps @mentions as written and leaves snake_case alone', () => {
    expect(messageSnippet('@Ann Perera can you check snake_case_name?')).toBe('@Ann Perera can you check snake_case_name?')
    expect(messageSnippet('ping @[Ann](/people/1)')).toBe('ping @Ann')
  })

  it('reads a shared file as 📎 and its name', () => {
    expect(messageSnippet(fileMessageBody('a1b2', 'spec.pdf', false))).toBe('📎 spec.pdf')
    expect(messageSnippet(fileMessageBody('a1b2', 'shot.png', true))).toBe('📎 shot.png')
    expect(messageSnippet('📎 [](/api/attachments/a1b2)')).toBe('📎 file')
  })

  it('clips to the limit with an ellipsis', () => {
    const out = messageSnippet('word '.repeat(40))
    expect(out.length).toBeLessThanOrEqual(SNIPPET_MAX)
    expect(out.endsWith('…')).toBe(true)
    expect(messageSnippet('short')).toBe('short')
  })
})

describe('previewLine', () => {
  it('names the author, says You for the viewer, never shows a deleted body', () => {
    expect(previewLine({ authorName: 'Ann', mine: false, snippet: 'hi', deleted: false })).toBe('Ann: hi')
    expect(previewLine({ authorName: 'Me', mine: true, snippet: 'hi', deleted: false })).toBe('You: hi')
    expect(previewLine({ authorName: 'Ann', mine: false, snippet: 'secret', deleted: true })).toBe('Message deleted')
  })
})

describe('relativeTime (Asia/Colombo)', () => {
  it('minutes, hours, yesterday, then a short date', () => {
    expect(relativeTime(new Date(NOON.getTime() - 20_000), NOON)).toBe('now')
    expect(relativeTime(new Date(NOON.getTime() - 4 * 60_000), NOON)).toBe('4m')
    expect(relativeTime(new Date(NOON.getTime() - 61 * 60_000), NOON)).toBe('1h')
    expect(relativeTime('2026-11-03T15:00:00Z', NOON)).toBe('Yesterday') // 20:30 Tue in Colombo
    expect(relativeTime('2026-11-02T06:30:00Z', NOON)).toBe('2 Nov')
    expect(relativeTime('2025-12-31T06:30:00Z', NOON)).toBe('31 Dec 2025')
  })

  it('a moment past midnight in Colombo is today there, though still yesterday in UTC', () => {
    const justAfterMidnight = new Date('2026-11-03T18:40:00Z') // 00:10 Wed in Colombo
    const now = new Date('2026-11-04T04:00:00Z')
    expect(relativeTime(justAfterMidnight, now)).toBe('9h')
  })
})

describe('dayLabel and clockTime (Asia/Colombo)', () => {
  it('Today, Yesterday, then weekday and date', () => {
    expect(dayLabel('2026-11-04T00:00:00Z', NOON)).toBe('Today')
    expect(dayLabel('2026-11-03T18:29:00Z', NOON)).toBe('Yesterday') // 23:59 Tue
    expect(dayLabel('2026-11-02T06:30:00Z', NOON)).toBe('Mon, 2 Nov')
  })

  it('prints the Colombo wall clock', () => {
    expect(clockTime('2026-11-04T10:35:00Z')).toBe('4:05 PM')
    expect(clockTime(new Date('2026-11-03T18:40:00Z'))).toBe('12:10 AM')
  })
})

describe('messageRuns', () => {
  const at = (iso: string) => new Date(iso)
  it('groups one author within five minutes, breaks on author, gap or day', () => {
    const runs = messageRuns([
      { authorId: 'a', createdAt: at('2026-11-04T06:00:00Z') },
      { authorId: 'a', createdAt: at('2026-11-04T06:04:00Z') }, // same run
      { authorId: 'b', createdAt: at('2026-11-04T06:05:00Z') }, // new author
      { authorId: 'b', createdAt: at('2026-11-04T06:11:00Z') }, // gap > 5 min
      { authorId: 'b', createdAt: at('2026-11-04T18:29:00Z') }, // 23:59 Colombo, same day
      { authorId: 'b', createdAt: at('2026-11-04T18:31:00Z') }, // 00:01 next day
    ])
    expect(runs).toEqual([
      { newDay: true, startsRun: true },
      { newDay: false, startsRun: false },
      { newDay: false, startsRun: true },
      { newDay: false, startsRun: true },
      { newDay: false, startsRun: true },
      { newDay: true, startsRun: true },
    ])
    expect(messageRuns([])).toEqual([])
  })
})
