import { describe, expect, it } from 'vitest'
import { MENTION_SUGGESTION_LIMIT, findMentionQuery, matchMentions } from './mention-match'

const USERS = [
  { id: 'u1', name: 'Shanika Ayasmanthi' },
  { id: 'u2', name: 'Deeghayu Adhikari' },
  { id: 'u3', name: 'Sam Perera' },
  { id: 'u4', name: 'Sam Fernando' },
]

/** Ids in the order the popover would render them. */
function ids(query: string, users = USERS) {
  return matchMentions(query, users).map((s) => s.user.id)
}

function kinds(query: string, users = USERS) {
  return matchMentions(query, users).map((s) => s.kind)
}

describe('matchMentions', () => {
  it('takes an exact name first', () => {
    expect(matchMentions('Shanika Ayasmanthi', USERS)).toEqual([
      { user: USERS[0], kind: 'exact' },
    ])
  })

  it('matches a prefix of the full name', () => {
    expect(ids('deegh')).toEqual(['u2'])
    expect(kinds('deegh')).toEqual(['name-prefix'])
    // The prefix may run across the space in the name.
    expect(ids('shanika a')).toEqual(['u1'])
    expect(kinds('shanika a')).toEqual(['name-prefix'])
  })

  it('matches a prefix of any word, so a last name resolves', () => {
    expect(ids('ayas')).toEqual(['u1'])
    expect(kinds('ayas')).toEqual(['word-prefix'])
    expect(ids('perera')).toEqual(['u3'])
    expect(ids('adhik')).toEqual(['u2'])
  })

  it('matches two tokens against different words in either order', () => {
    expect(ids('shan ayas')).toEqual(['u1'])
    expect(kinds('shan ayas')).toEqual(['tokens'])
    expect(ids('ayasmanthi shanika')).toEqual(['u1'])
    expect(kinds('ayasmanthi shanika')).toEqual(['tokens'])
    expect(ids('perera sam')).toEqual(['u3'])
    // Both tokens must land on DIFFERENT words — "sam sam" is not Sam Perera.
    expect(ids('sam sam')).toEqual([])
  })

  it('matches initials, but ranks them below every real prefix', () => {
    expect(ids('da')).toEqual(['u2'])
    expect(kinds('da')).toEqual(['initials'])
    // "sa" prefixes both Sams and initialises Shanika Ayasmanthi; the prefixes win.
    expect(ids('sa')).toEqual(['u4', 'u3', 'u1'])
    expect(kinds('sa')).toEqual(['name-prefix', 'name-prefix', 'initials'])
  })

  it('still matches a substring anywhere in the name', () => {
    expect(ids('anth')).toEqual(['u1'])
    expect(kinds('anth')).toEqual(['substring'])
    expect(ids('ernand')).toEqual(['u4'])
  })

  it('rescues a typo through the fuzzy fallback', () => {
    expect(ids('deghayu')).toEqual(['u2'])
    expect(kinds('deghayu')).toEqual(['fuzzy'])
    expect(ids('shanka')).toEqual(['u1'])
    // A typo in either half of a two-word query still lands.
    expect(ids('sam pererra')).toEqual(['u3'])
    expect(ids('shanik ayasmanth')).toEqual(['u1'])
  })

  it('keeps every equally-close typo match rather than guessing one', () => {
    const twins = [
      { id: 'a', name: 'Sam Fernando' },
      { id: 'b', name: 'Sam Fernandu' },
    ]
    expect(matchMentions('sam fernandi', twins).map((s) => s.user.id)).toEqual(['a', 'b'])
    expect(matchMentions('sam fernandi', twins).map((s) => s.kind)).toEqual(['fuzzy', 'fuzzy'])
  })

  it('never falls back to fuzzy while any deterministic rule matched', () => {
    // "sam" prefixes two people; the near-miss "Shanika" must not be dragged in.
    expect(kinds('sam')).toEqual(['name-prefix', 'name-prefix'])
    expect(kinds('shanika')).toEqual(['name-prefix'])
    expect(kinds('anth')).not.toContain('fuzzy')
  })

  it('keeps everyone who shares a first name', () => {
    // Sorted by name, so the pair is stable and neither silently wins.
    expect(ids('sam')).toEqual(['u4', 'u3'])
  })

  it('deduplicates by id and keeps the best match kind', () => {
    const duplicated = [
      { id: 'u1', name: 'Shanika Ayasmanthi' },
      { id: 'u1', name: 'Shanika Ayasmanthi' },
      { id: 'u3', name: 'Sam Perera' },
    ]
    expect(matchMentions('shanika', duplicated)).toEqual([
      { user: duplicated[0], kind: 'name-prefix' },
    ])
  })

  it('caps the list at six rows', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `s${i}`,
      name: `Sam Number ${i}`,
    }))
    expect(matchMentions('sam', many)).toHaveLength(MENTION_SUGGESTION_LIMIT)
    expect(matchMentions('sam', many).map((s) => s.user.id)).toEqual([
      's0', 's1', 's2', 's3', 's4', 's5',
    ])
  })

  it('offers everyone, by name, for a bare "@"', () => {
    expect(ids('')).toEqual(['u2', 'u4', 'u3', 'u1'])
    expect(kinds('')).not.toContain('fuzzy')
    expect(matchMentions('', [])).toEqual([])
  })

  it('returns nothing when nobody is close', () => {
    expect(ids('zzzz')).toEqual([])
    expect(ids('qwerty mnbvc')).toEqual([])
  })

  it('orders by rank then name, never by input order', () => {
    const reversed = [...USERS].reverse()
    expect(ids('sa', reversed)).toEqual(ids('sa'))
    expect(ids('', reversed)).toEqual(ids(''))
  })

  it('ignores case and padding around the query', () => {
    expect(ids('  AYAS  ')).toEqual(['u1'])
    expect(ids('SHAN   AYAS')).toEqual(['u1'])
  })
})

describe('findMentionQuery', () => {
  /** Reads the mention at the end of `text`, which is where the caret sits while typing. */
  function atEnd(text: string) {
    return findMentionQuery(text, text.length)
  }

  it('reads the token the caret is inside', () => {
    expect(atEnd('hello @sam')).toEqual({ start: 6, query: 'sam' })
    expect(atEnd('@sam')).toEqual({ start: 0, query: 'sam' })
    // A bare '@' opens the full list.
    expect(atEnd('@')).toEqual({ start: 0, query: '' })
  })

  it('carries a second word through, so "@shan ayas" can match', () => {
    expect(atEnd('@shan ayas')).toEqual({ start: 0, query: 'shan ayas' })
    expect(atEnd('nice work @ayasmanthi shanika')).toEqual({
      start: 10,
      query: 'ayasmanthi shanika',
    })
    // …and the two halves resolve to one person.
    expect(ids('shan ayas')).toEqual(['u1'])
  })

  it('keeps the popover open while a Sinhala name is typed', () => {
    // Sinhala vowel signs (ී) and the al-lakuna (්) are combining marks
    // (\p{M}), not letters — a letters-only word class closes the popover on
    // the second character of virtually every Sinhala name.
    expect(atEnd('@දී')).toEqual({ start: 0, query: 'දී' })
    expect(atEnd('@සමන්')).toEqual({ start: 0, query: 'සමන්' })
    expect(atEnd('hey @ශනිකා')).toEqual({ start: 4, query: 'ශනිකා' })
  })

  it('stops at a third word, so a sentence after "@" is not a name', () => {
    expect(atEnd('@sam can you')).toBeNull()
    expect(atEnd('@shan ayas manthi')).toBeNull()
  })

  it('ends the token at a trailing space, so a completed mention stays closed', () => {
    // What MentionTextarea leaves behind after inserting a mention.
    expect(atEnd('@Shanika Ayasmanthi ')).toBeNull()
    expect(atEnd('@sam ')).toBeNull()
  })

  it('ends the token on punctuation and newlines', () => {
    expect(atEnd('@sam.')).toBeNull()
    expect(atEnd('@sam, please look')).toBeNull()
    expect(atEnd('@sam?')).toBeNull()
    expect(atEnd('@sam\nnext line')).toBeNull()
    expect(atEnd('@sam\n')).toBeNull()
  })

  it('keeps punctuation that belongs inside names', () => {
    expect(atEnd("@o'neil")).toEqual({ start: 0, query: "o'neil" })
    expect(atEnd('@anne-marie')).toEqual({ start: 0, query: 'anne-marie' })
  })

  it('ignores an "@" that does not start a word', () => {
    expect(atEnd('mail me at sam@logpup.app')).toBeNull()
    expect(atEnd('sam@logpup')).toBeNull()
  })

  it('tracks the newest mention when an earlier one is already complete', () => {
    expect(atEnd('@Sam Perera hi @dee')).toEqual({ start: 15, query: 'dee' })
  })

  it('reads from the caret, not the end of the text', () => {
    const text = 'hi @sam there'
    expect(findMentionQuery(text, 7)).toEqual({ start: 3, query: 'sam' })
    // Caret before the '@' — nothing is being mentioned yet.
    expect(findMentionQuery(text, 2)).toBeNull()
  })

  it('finds nothing when there is no "@" at all', () => {
    expect(atEnd('just a comment')).toBeNull()
    expect(atEnd('')).toBeNull()
  })
})
