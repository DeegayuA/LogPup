import { describe, expect, it } from 'vitest'
import { JOB_ROLES } from './job-roles'
import { TOPIC_BUCKETS, matchAgendaTopic } from './agenda-topics'

// --- the lint test — this is the point of this task -------------------------
//
// An 8-bucket table over a ~70-role vocabulary silently scores Support,
// Finance, HR, Marketing and every generalist engineer at zero, and in the UI
// a structural zero is indistinguishable from "we checked and they're not
// relevant". Every role quoted verbatim from JOB_ROLE_GROUPS must show up
// somewhere in the bucket table, or the E3 signal quietly stops covering them.
describe('TOPIC_BUCKETS role coverage (lint)', () => {
  it('places every JOB_ROLES value in at least one bucket primaryRoles or adjacentRoles', () => {
    const covered = new Set<string>()
    for (const bucket of TOPIC_BUCKETS) {
      for (const role of bucket.primaryRoles) covered.add(role)
      for (const role of bucket.adjacentRoles) covered.add(role)
    }
    const missing = JOB_ROLES.filter((role) => !covered.has(role))
    expect(missing).toEqual([])
  })

  it('quotes every bucket role verbatim from JOB_ROLES (no typo\'d role strings)', () => {
    const known = new Set(JOB_ROLES)
    const unknown = new Set<string>()
    for (const bucket of TOPIC_BUCKETS) {
      for (const role of [...bucket.primaryRoles, ...bucket.adjacentRoles]) {
        if (!known.has(role)) unknown.add(role)
      }
    }
    expect([...unknown]).toEqual([])
  })

  it('has more than 8 buckets (an 8-bucket table cannot cover a 70-role vocabulary)', () => {
    expect(TOPIC_BUCKETS.length).toBeGreaterThan(8)
  })

  it('gives every bucket a non-empty name and at least one keyword', () => {
    for (const bucket of TOPIC_BUCKETS) {
      expect(bucket.name.trim().length).toBeGreaterThan(0)
      expect(bucket.keywords.length).toBeGreaterThan(0)
    }
  })
})

// --- matchAgendaTopic ---------------------------------------------------------

describe('matchAgendaTopic', () => {
  it('matches whole words only — "design" must not match inside "redesigned"', () => {
    const result = matchAgendaTopic('We redesigned the onboarding flow', ['UI/UX Designer'])
    expect(result.hit).toBe('none')
  })

  it('still matches "design" as its own word', () => {
    const result = matchAgendaTopic('Design review for the checkout flow', ['UI/UX Designer'])
    expect(result.hit).toBe('primary')
  })

  it('is case-insensitive', () => {
    const lower = matchAgendaTopic('design review', ['UI/UX Designer'])
    const upper = matchAgendaTopic('DESIGN REVIEW', ['UI/UX Designer'])
    const mixed = matchAgendaTopic('DeSiGn ReVieW', ['ui/ux designer'])
    expect(lower.hit).toBe('primary')
    expect(upper.hit).toBe('primary')
    expect(mixed.hit).toBe('primary')
  })

  it('returns the matching agenda quote — the actual matched span, not a paraphrase', () => {
    const result = matchAgendaTopic(
      'Agenda: review the new checkout flow mockups before launch',
      ['UI/UX Designer'],
    )
    expect(result.hit).toBe('primary')
    expect(result.bucket).toBeTruthy()
    expect(result.quote).toBeTruthy()
    // the quote must be a verbatim substring of the input text
    expect(result.quote && result.quote.length > 0).toBe(true)
    expect(
      result.quote ? result.quote.toLowerCase() : '',
    ).toEqual(expect.stringMatching(/mockup/i))
  })

  it('returns adjacent for a role listed only in adjacentRoles', () => {
    const result = matchAgendaTopic('Design review for the checkout flow', ['Product Manager'])
    expect(result.hit).toBe('adjacent')
    expect(result.bucket).toBeTruthy()
  })

  it('returns none when the role matches no bucket for this text (never a penalty)', () => {
    // "Finance" is not a primary/adjacent role of the design bucket, and no
    // other bucket's keywords appear in this text either.
    const result = matchAgendaTopic('Design review for the checkout flow', ['Finance'])
    expect(result.hit).toBe('none')
    expect(result.bucket).toBeUndefined()
    expect(result.quote).toBeUndefined()
  })

  it('returns none for a role that matches no bucket at all, regardless of text', () => {
    // Sanity: an unrecognised, made-up role string never produces a hit.
    const result = matchAgendaTopic('QA sign-off before the release', ['Underwater Basket Weaver'])
    expect(result.hit).toBe('none')
  })

  it('returns none for empty text', () => {
    expect(matchAgendaTopic('', ['UI/UX Designer']).hit).toBe('none')
  })

  it('returns none for whitespace-only text', () => {
    expect(matchAgendaTopic('   \n\t  ', ['UI/UX Designer']).hit).toBe('none')
  })

  it('returns none when roleTokens is empty', () => {
    expect(matchAgendaTopic('Design review', []).hit).toBe('none')
  })

  it('the best single bucket wins — a primary hit is found even when a non-matching bucket also fires', () => {
    // "design" fires the Design bucket, "qa" fires the QA bucket. A QA Engineer
    // is primary in the QA bucket only; the function must not settle for the
    // Design bucket (where QA Engineer is neither primary nor adjacent) just
    // because it happens to be scanned differently.
    const result = matchAgendaTopic('Design and QA sign-off before the release', ['QA Engineer'])
    expect(result.hit).toBe('primary')
  })

  it('buckets do not stack — a role primary in two matching buckets still yields one single hit', () => {
    const result = matchAgendaTopic(
      'Frontend design review for the checkout flow',
      ['Frontend Developer'],
    )
    expect(result.hit).toBe('primary')
    // exactly one bucket is cited, never a combined/aggregate result
    expect(typeof result.bucket).toBe('string')
  })

  it('matches multi-word keywords as whole phrases', () => {
    const result = matchAgendaTopic('Quarterly sprint retrospective planning', ['Scrum Master'])
    expect(result.hit).toBe('primary')
  })
})
