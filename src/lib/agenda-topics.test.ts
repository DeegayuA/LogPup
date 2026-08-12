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

  it('matches keywords that happen to be single words, inside a longer phrase', () => {
    // Renamed from "matches multi-word keywords as whole phrases" — this case
    // exercises "sprint"/"retrospective", which are single-word keywords, not
    // multi-word phrases. See the next test for genuine phrase matching.
    const result = matchAgendaTopic('Quarterly sprint retrospective planning', ['Scrum Master'])
    expect(result.hit).toBe('primary')
  })

  it('matches a genuine multi-word keyword phrase as a whole, not a fragment of unrelated words', () => {
    const positive = matchAgendaTopic("Let's do a thorough code review before merging", ['Tech Lead'])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Engineering architecture & leadership')
    expect(positive.quote).toEqual(expect.stringMatching(/code review/i))

    // "encoded reviewer" contains letters that look adjacent to "code review"
    // but is not that literal phrase anywhere in the string — whole-phrase
    // matching must not be fooled by a near-miss.
    const negative = matchAgendaTopic('We hired a new encoded reviewer this week', ['Tech Lead'])
    expect(negative.hit).toBe('none')
  })

  it('quote is the earliest-occurring matching keyword in the text, not the first one listed in the bucket', () => {
    // Within "QA & testing", 'quality assurance' sits before 'sign-off' in
    // the source array, but here it also occurs first IN THE TEXT — this
    // pins that the selection is by text position, not array order.
    const early = matchAgendaTopic('Quality assurance sign-off needed before release', ['QA Engineer'])
    expect(early.hit).toBe('primary')
    expect(early.quote).toEqual(expect.stringMatching(/quality assurance/i))

    // Reversed: here 'sign-off' occurs first in the text even though
    // 'quality assurance' is still listed earlier in the bucket's array —
    // the cited quote must follow the text, not the array.
    const reversed = matchAgendaTopic('Sign-off is pending; quality assurance flagged one issue', [
      'QA Engineer',
    ])
    expect(reversed.hit).toBe('primary')
    expect(reversed.quote).toEqual(expect.stringMatching(/sign-off/i))
  })
})

// --- keyword precision regression tests --------------------------------------
//
// A primary hit is the one signal that FLOORS a candidate to `required`
// (spec E3/R6) — a false positive here doesn't just add noise, it manufactures
// a wrong required tier. Several buckets originally used bare, common English
// words (e.g. "board", "model", "support", "network", "content") as their sole
// keyword, which fire on completely unrelated everyday usage. Each pair below
// pins the false positive as fixed AND that the intended, more specific
// phrasing still matches — these tests are the documentation of where the
// line is drawn.
describe('matchAgendaTopic — keyword precision (false-positive regressions)', () => {
  it('"board" — a circuit board is not a boardroom', () => {
    const negative = matchAgendaTopic('Finalize the new circuit board layout for the enclosure', ['CEO'])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic("Preparing the deck for Monday's board meeting", ['CEO'])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Executive & leadership')
    expect(positive.quote).toEqual(expect.stringMatching(/board meeting/i))
  })

  it('"model" — a pricing model is not an ML model', () => {
    const negative = matchAgendaTopic('Finalize the new pricing model before the client call', [
      'Data Scientist',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('Review the model training results before the demo', [
      'Data Scientist',
    ])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Data & machine learning')
    expect(positive.quote).toEqual(expect.stringMatching(/model training/i))
  })

  it('"support" — a schema supporting multi-tenant data is not customer support', () => {
    const negative = matchAgendaTopic('Will the new schema support multi-tenant data?', ['Support'])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('The support ticket queue needs review before lunch', ['Support'])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Support & customer success')
    expect(positive.quote).toEqual(expect.stringMatching(/support ticket/i))
  })

  it('"network" — a partner network is not the infrastructure network', () => {
    const negative = matchAgendaTopic('Grow our partner network in the region this quarter', [
      'Network Engineer',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic("Investigating last night's network outage across the region", [
      'Network Engineer',
    ])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('DevOps, infrastructure & security')
    expect(positive.quote).toEqual(expect.stringMatching(/network outage/i))
  })

  it('"content" — API response content is not marketing content', () => {
    const negative = matchAgendaTopic('Validate the response content returned by the new endpoint', [
      'Marketing',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('Review the content calendar before the launch', ['Marketing'])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Marketing & sales')
    expect(positive.quote).toEqual(expect.stringMatching(/content calendar/i))
  })

  it('"schedule" — "let\'s schedule a call" is not a delivery schedule', () => {
    const negative = matchAgendaTopic("Let's schedule a quick call for tomorrow afternoon", [
      'Project Manager',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('The release schedule needs revisiting before launch', [
      'Project Manager',
    ])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Delivery & project management')
    expect(positive.quote).toEqual(expect.stringMatching(/release schedule/i))
  })

  it('"quality" — quality craftsmanship is not quality assurance', () => {
    const negative = matchAgendaTopic('The team takes quality seriously in everything they build', [
      'QA Engineer',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('quality assurance sign-off needed before release', ['QA Engineer'])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('QA & testing')
    expect(positive.quote).toEqual(expect.stringMatching(/quality assurance/i))
  })

  it('"component" — a hardware component is not a UI component', () => {
    const negative = matchAgendaTopic('Order the replacement component for the industrial enclosure', [
      'Frontend Developer',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('We need to refactor the shared React component library', [
      'Frontend Developer',
    ])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Frontend & client engineering')
    expect(positive.quote).toEqual(expect.stringMatching(/react component/i))
  })

  it('"database" — a database of vendor contacts is not a schema/engineering database', () => {
    const negative = matchAgendaTopic('Sort the database of vendor contacts before the meeting', [
      'Backend Developer',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('Review the database schema before we ship the migration', [
      'Backend Developer',
    ])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Backend & API engineering')
    expect(positive.quote).toEqual(expect.stringMatching(/database schema/i))
  })

  // --- round 2: four disclosed leftovers, confirmed dangerous by live probes -

  it('"customer" — customer feedback/research is not customer support', () => {
    const negative = matchAgendaTopic(
      "Let's review customer feedback from the last product survey",
      ['Support'],
    )
    expect(negative.hit).not.toBe('primary')
    const negative2 = matchAgendaTopic('A customer stopped by the office to drop off a package', [
      'Support',
    ])
    expect(negative2.hit).not.toBe('primary')

    const positive = matchAgendaTopic('The customer support queue grew significantly this week', [
      'Support',
    ])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Support & customer success')
    expect(positive.quote).toEqual(expect.stringMatching(/customer support/i))
  })

  it('"ticket" — a concert ticket is not a support ticket', () => {
    const negative = matchAgendaTopic('Can someone grab me a concert ticket for Friday night?', [
      'Support',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('Log this as a new support ticket for the billing team', [
      'Support',
    ])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Support & customer success')
    expect(positive.quote).toEqual(expect.stringMatching(/support ticket/i))
  })

  it('"data" — sales data for a board deck is not a Data Engineer\'s data pipeline', () => {
    const negative = matchAgendaTopic('Please pull the latest sales data for the board deck', [
      'Data Engineer',
    ])
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic('Review the data pipeline before the demo', ['Data Engineer'])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Data & machine learning')
    expect(positive.quote).toEqual(expect.stringMatching(/data pipeline/i))
  })

  it('"migration" — an office/team migration is not a schema migration', () => {
    const negative = matchAgendaTopic(
      "We're planning the office migration to the new building next month",
      ['Backend Developer'],
    )
    expect(negative.hit).not.toBe('primary')

    const positive = matchAgendaTopic("The schema migration needs to run before Friday's release", [
      'Backend Developer',
    ])
    expect(positive.hit).toBe('primary')
    expect(positive.bucket).toBe('Backend & API engineering')
    expect(positive.quote).toEqual(expect.stringMatching(/schema migration/i))
  })
})

// --- keyword denylist guard (closes the class, not just the instances) ------
//
// A bare, single-token keyword floors a candidate to `required` on ANY
// sentence containing that word, no matter the domain — round 1 fixed nine of
// these ("board" fired on "circuit board", "model" on "pricing model", etc.)
// and round 2 found four more disclosed leftovers plus a wider sweep across
// all 19 buckets. This denylist is the accumulated list of generic workplace
// nouns that are NEVER acceptable as a bare (single-token, no internal space)
// keyword in any bucket — they routinely appear in ordinary business sentences
// that have nothing to do with the bucket that would use them. They may still
// appear inside a genuinely qualifying multi-word phrase ("board meeting",
// "customer support", "data pipeline") — that's what the multi-word keywords
// added across both review rounds are for.
//
// A single-word keyword is only acceptable when the word is genuinely
// domain-specific and effectively unambiguous outside its bucket's domain —
// "kubernetes", "postgres", "figma", "onboarding", "payroll", "refactor" are
// fine; "data" is not. If a future bucket or keyword trips this test, the fix
// is to qualify it with a phrase and add the bare word here — not to widen
// the test or delete the failing case.
const GENERIC_KEYWORD_DENYLIST = [
  // round 1
  'data', 'board', 'model', 'support', 'network', 'content', 'schedule',
  'quality', 'component', 'database',
  // round 2 — reviewer-disclosed leftovers
  'customer', 'ticket', 'migration',
  // round 2 — reviewer's seed list, verified absent or fixed
  'team', 'project', 'product', 'meeting', 'review', 'plan', 'update',
  'issue', 'request', 'report',
  // round 2 — found sweeping all 19 buckets
  'pipeline', 'security', 'vulnerability', 'metrics', 'milestone', 'timeline',
  'executive', 'agreement', 'logistics', 'infrastructure', 'incident',
  'immunity', 'conducted', 'testing', 'interface', 'responsive',
  'accessibility', 'branding', 'visual', 'illustration', 'deal', 'pitch',
  'roadmap', 'requirements', 'feature', 'spec', 'interview', 'culture',
  'compliance', 'strategy', 'budget', 'leadership', 'quarterly',
  'integration', 'dashboard', 'embedded', 'architecture', 'certification',
  'campaign', 'prospect', 'contract', 'policy', 'deployment', 'financial',
  'emissions', 'prototype', 'sign-off', 'retro', 'escalation',
]

describe('TOPIC_BUCKETS keyword precision (denylist guard)', () => {
  it('never uses a denylisted generic word as a bare (single-token) keyword', () => {
    const denylist = new Set(GENERIC_KEYWORD_DENYLIST.map((w) => w.toLowerCase()))
    const offenders: string[] = []
    for (const bucket of TOPIC_BUCKETS) {
      for (const keyword of bucket.keywords) {
        const isSingleToken = keyword.trim().split(/\s+/).length === 1
        if (isSingleToken && denylist.has(keyword.trim().toLowerCase())) {
          offenders.push(`${bucket.name}: "${keyword}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the coverage lint still passes after keyword tightening (no role stranded)', () => {
    const covered = new Set<string>()
    for (const bucket of TOPIC_BUCKETS) {
      for (const role of bucket.primaryRoles) covered.add(role)
      for (const role of bucket.adjacentRoles) covered.add(role)
    }
    expect(JOB_ROLES.filter((role) => !covered.has(role))).toEqual([])
  })
})
