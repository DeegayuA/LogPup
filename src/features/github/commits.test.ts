import { describe, expect, it } from 'vitest'

import { commitPromptLines, toCommitEvidence, type GithubCommitRow } from './commits'

const row = (over: Partial<GithubCommitRow> & { message?: string } = {}): GithubCommitRow => ({
  sha: over.sha ?? 'abc123',
  html_url: over.html_url ?? 'https://github.com/acme/kestrel/commit/abc123',
  commit: {
    message: over.message ?? 'fix: rate limiter drift',
    author: { date: '2026-08-20T09:15:00Z' },
    committer: { date: '2026-08-21T02:00:00Z' },
    ...over.commit,
  },
})

describe('toCommitEvidence', () => {
  it('keeps only the subject line of a multi-paragraph message', () => {
    const [c] = toCommitEvidence(
      [row({ message: 'feat: bucket algorithm\n\nLong body nobody should prompt with.' })],
      'acme/kestrel',
    )
    expect(c.message).toBe('feat: bucket algorithm')
  })

  it('prefers the author date over the committer date', () => {
    // A rebase rewrites committer stamps wholesale; the author date is when
    // the work happened, which is the question a worklog asks.
    const [c] = toCommitEvidence([row()], 'acme/kestrel')
    expect(c.authoredAtIso).toBe('2026-08-20T09:15:00Z')
  })

  it('falls back to the committer date, and drops a row with neither', () => {
    const noAuthor = row()
    noAuthor.commit.author = null
    const dateless = row({ sha: 'def456' })
    dateless.commit.author = null
    dateless.commit.committer = null
    const mapped = toCommitEvidence([noAuthor, dateless], 'acme/kestrel')
    expect(mapped).toHaveLength(1)
    expect(mapped[0].authoredAtIso).toBe('2026-08-21T02:00:00Z')
  })
})

describe('commitPromptLines', () => {
  it('orders oldest first and omits clock times', () => {
    const commits = toCommitEvidence(
      [
        row({ sha: 'b', message: 'second' }),
        row({ sha: 'a', message: 'first' }),
      ],
      'acme/kestrel',
    )
    commits[0].authoredAtIso = '2026-08-20T15:00:00Z'
    commits[1].authoredAtIso = '2026-08-20T09:00:00Z'
    const lines = commitPromptLines(commits)
    expect(lines).toEqual(['- [acme/kestrel] first', '- [acme/kestrel] second'])
    // No timestamps in the line: gaps between commits are not durations, and
    // handing the model clock times invites it to pretend they are.
    expect(lines.join('\n')).not.toMatch(/\d{2}:\d{2}/)
  })
})
