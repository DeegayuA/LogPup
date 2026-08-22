import { describe, expect, it } from 'vitest'

import {
  classifyMention,
  mentionAdvisory,
  worthReporting,
  type MentionFacts,
} from './mention-rules'

const facts = (over: Partial<MentionFacts> = {}): MentionFacts => ({
  isSelf: false,
  isActive: true,
  isApproved: true,
  hasAccess: true,
  supersededByAssignment: false,
  ...over,
})

describe('classifyMention', () => {
  it('delivers to an active colleague who can see the thing', () => {
    expect(classifyMention(facts())).toBeNull()
  })

  it('never notifies somebody about naming themselves', () => {
    expect(classifyMention(facts({ isSelf: true }))).toBe('self')
  })

  it('calls an offer an offer, rather than an access failure', () => {
    // Order matters here: without the assignment arm sitting above the access
    // checks, somebody being handed a task on a project they are not yet on
    // would be reported to the author as "can't see it" — sending them to fix
    // a permission that the assignment itself is about to make moot.
    expect(
      classifyMention(facts({ supersededByAssignment: true, hasAccess: false })),
    ).toBe('assignment_supersedes')
  })

  it('reports a deactivated or unapproved seat as inactive, not as no_access', () => {
    // A deactivated seat is not a scope problem, and saying so sends the author
    // to an admin to fix the wrong thing.
    expect(classifyMention(facts({ isActive: false }))).toBe('inactive')
    expect(classifyMention(facts({ isApproved: false }))).toBe('inactive')
    expect(classifyMention(facts({ isActive: false, hasAccess: false }))).toBe('inactive')
  })

  it('reports somebody who simply cannot open it', () => {
    expect(classifyMention(facts({ hasAccess: false }))).toBe('no_access')
  })
})

describe('what the author is told', () => {
  it('says nothing when everything was delivered', () => {
    expect(mentionAdvisory([], 'Atlas')).toBeNull()
  })

  it('says nothing about naming yourself, or about an offer', () => {
    // Both reached the person, or concern nobody. An advisory here would be a
    // warning about something that worked.
    expect(worthReporting('self')).toBe(false)
    expect(worthReporting('assignment_supersedes')).toBe(false)
    expect(
      mentionAdvisory(
        [
          { name: 'Ama', reason: 'self' },
          { name: 'Nuwan', reason: 'assignment_supersedes' },
        ],
        'Atlas',
      ),
    ).toBeNull()
  })

  it('names the person and the thing they cannot see', () => {
    // "Some mentions were not delivered" is a message nobody can act on.
    expect(mentionAdvisory([{ name: 'Nuwan', reason: 'no_access' }], 'Atlas')).toBe(
      'Nuwan can’t see Atlas — mention recorded, not notified.',
    )
  })

  it('always says the mention was RECORDED', () => {
    // The load-bearing half: kept, so nobody retypes it; not delivered, so
    // nobody assumes it arrived.
    const advisory = mentionAdvisory([{ name: 'Nuwan', reason: 'no_access' }], 'Atlas')
    expect(advisory).toContain('recorded, not notified')
  })

  it('lists several people readably', () => {
    expect(
      mentionAdvisory(
        [
          { name: 'Ama', reason: 'no_access' },
          { name: 'Nuwan', reason: 'no_access' },
          { name: 'Sana', reason: 'no_access' },
        ],
        'Atlas',
      ),
    ).toBe('Ama, Nuwan and Sana can’t see Atlas — mention recorded, not notified.')
  })

  it('separates the two reasons rather than blaming one for the other', () => {
    expect(
      mentionAdvisory(
        [
          { name: 'Nuwan', reason: 'no_access' },
          { name: 'Ama', reason: 'inactive' },
        ],
        'Atlas',
      ),
    ).toBe('Nuwan can’t see Atlas; Ama has no active seat — mention recorded, not notified.')
  })

  it('still says something useful when the source has no name', () => {
    expect(mentionAdvisory([{ name: 'Nuwan', reason: 'no_access' }], null)).toBe(
      'Nuwan can’t see what you named them in — mention recorded, not notified.',
    )
  })
})
