import { describe, it, expect } from 'vitest'
import {
  CONTEXT_CHARS,
  MAX_SELECTED_WORDS,
  MAX_TERM_CHARS,
  applyReplacements,
  diffSingleWord,
  editDistance,
  findOccurrences,
  fuzzyBudget,
  groupOccurrences,
  normalizeSelectedTerm,
  tokenize,
  type Occurrence,
  type SearchTarget,
} from './text-replace'

function target(
  id: string,
  text: string,
  kind: SearchTarget['kind'] = 'segment',
  label?: string,
): SearchTarget {
  return { id, kind, text, label }
}

// Sinhala fixtures, written once so every test below reads the same word.
// ශානික = a first name; ශානිකගේ is the same name with a genitive suffix glued
// on — the shape that a naive substring search reports as a second "hit" on
// the name itself.
const NAME_SI = 'ශානික'
const NAME_SI_POSSESSIVE = 'ශානිකගේ'

describe('fuzzyBudget', () => {
  it('gives short words no budget at all', () => {
    // The rule the whole feature rests on: at this length an edit is a
    // different word, so bulk-replacing near-misses would be destructive.
    expect(fuzzyBudget(1)).toBe(0)
    expect(fuzzyBudget(3)).toBe(0)
    expect(fuzzyBudget(4)).toBe(0)
  })

  it('allows one edit from five to eight characters', () => {
    expect(fuzzyBudget(5)).toBe(1)
    expect(fuzzyBudget(7)).toBe(1)
    expect(fuzzyBudget(8)).toBe(1)
  })

  it('allows two edits beyond eight characters', () => {
    expect(fuzzyBudget(9)).toBe(2)
    expect(fuzzyBudget(30)).toBe(2)
  })
})

describe('editDistance', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('shanika', 'shanika', 2)).toBe(0)
  })

  it('counts a single substitution', () => {
    expect(editDistance('shanika', 'shanaka', 2)).toBe(1)
  })

  it('counts an insertion', () => {
    expect(editDistance('prabudda', 'prabuddha', 2)).toBe(1)
  })

  it('reports over-budget rather than the true distance', () => {
    // The cap is an optimisation, so callers only ever get "> max" back — not
    // a number they could compare against a different threshold.
    expect(editDistance('kitten', 'sitting', 1)).toBe(2)
    expect(editDistance('abc', 'abd', 0)).toBe(1)
  })

  it('rejects on length difference without scanning', () => {
    expect(editDistance('a', 'abcdef', 2)).toBe(3)
  })
})

describe('tokenize', () => {
  it('keeps punctuation out of words but apostrophes and hyphens in', () => {
    expect(tokenize("Shanika's report, Shanaka-Perera")).toEqual([
      { word: "Shanika's", start: 0 },
      { word: 'report', start: 10 },
      { word: 'Shanaka-Perera', start: 18 },
    ])
  })

  it('returns offsets that slice back to the token in the original text', () => {
    const text = `  ${NAME_SI} ගැන කතා කළා.`
    for (const token of tokenize(text)) {
      expect(text.slice(token.start, token.start + token.word.length)).toBe(token.word)
    }
  })

  it('finds no tokens in punctuation or whitespace', () => {
    expect(tokenize('   ')).toEqual([])
    expect(tokenize('… — ,')).toEqual([])
  })
})

describe('findOccurrences', () => {
  it('finds a term and carries the sentence around it', () => {
    const text = 'We agreed Shanika ships the report on Friday.'
    const [found, ...rest] = findOccurrences([target('s1', text)], 'Shanika')
    expect(rest).toEqual([])
    expect(found.start).toBe(text.indexOf('Shanika'))
    expect(found.matched).toBe('Shanika')
    expect(found.similarity).toBe(1)
    expect(found.approximate).toBe(false)
    expect(found.context.before).toBe('We agreed ')
    expect(found.context.after).toBe(' ships the report on Friday.')
  })

  it('ignores case by default and honours caseSensitive', () => {
    const text = 'Shanika and shanika'
    expect(findOccurrences([target('s1', text)], 'shanika')).toHaveLength(2)
    expect(
      findOccurrences([target('s1', text)], 'shanika', { caseSensitive: true }).map((o) => o.start),
    ).toEqual([text.indexOf('shanika')])
  })

  it('never matches inside a longer word', () => {
    const text = 'the catalogue lists one cat'
    expect(findOccurrences([target('s1', text)], 'cat').map((o) => o.start)).toEqual([
      text.indexOf('one cat') + 4,
    ])
  })

  it('trims the surrounding context to CONTEXT_CHARS', () => {
    const filler = 'word '.repeat(40)
    const text = `${filler}Shanika ${filler}`
    const [found] = findOccurrences([target('s1', text)], 'Shanika')
    expect(found.context.before).toHaveLength(CONTEXT_CHARS)
    expect(found.context.after).toHaveLength(CONTEXT_CHARS)
  })

  it('orders results by target, then by position', () => {
    const found = findOccurrences(
      [target('s2', 'Shanika again, Shanika'), target('s1', 'Shanika')],
      'Shanika',
    )
    expect(found.map((o) => [o.targetId, o.start])).toEqual([
      ['s2', 0],
      ['s2', 15],
      ['s1', 0],
    ])
  })

  it('carries the target kind and label onto every occurrence', () => {
    const [found] = findOccurrences([target('a1', 'Shanika owns it', 'action', 'Action item')], 'Shanika')
    expect(found.kind).toBe('action')
    expect(found.label).toBe('Action item')
  })

  it('returns nothing for a term with no words in it', () => {
    const targets = [target('s1', 'Shanika')]
    expect(findOccurrences(targets, '')).toEqual([])
    expect(findOccurrences(targets, '   ')).toEqual([])
    expect(findOccurrences(targets, '…—,')).toEqual([])
  })

  it('reports offsets that slice back to the matched text', () => {
    // applyReplacements re-checks exactly this before writing, so a find that
    // broke the invariant would show a review list where nothing applies.
    const targets = [
      target('s1', `${NAME_SI} ගැන කතා කළා. ${NAME_SI_POSSESSIVE} වැඩේ ඉවරයි.`),
      target('s2', 'Shanika and Shanaka met'),
    ]
    const found = findOccurrences(targets, NAME_SI, { fuzzy: true }).concat(
      findOccurrences(targets, 'Shanika', { fuzzy: true }),
    )
    expect(found.length).toBeGreaterThan(0)
    for (const occurrence of found) {
      const text = targets.find((t) => t.id === occurrence.targetId)!.text
      expect(text.slice(occurrence.start, occurrence.start + occurrence.matched.length)).toBe(
        occurrence.matched,
      )
    }
  })

  describe('short terms', () => {
    it('finds no near-misses however fuzzy the search is', () => {
      // "bug"/"bus" and දින/දිය are different words, not typos of each other.
      expect(findOccurrences([target('s1', 'the bus left')], 'bug', { fuzzy: true })).toEqual([])
      expect(findOccurrences([target('s1', 'දිය ගැන කතා')], 'දින', { fuzzy: true })).toEqual([])
    })

    it('still finds its exact matches', () => {
      const found = findOccurrences([target('s1', 'one bug, two bugs')], 'bug', { fuzzy: true })
      expect(found.map((o) => o.matched)).toEqual(['bug'])
    })
  })

  describe('Sinhala', () => {
    const text = `${NAME_SI} අද වැඩ කළා. ${NAME_SI_POSSESSIVE} report එක ලැබුණා.`

    it('matches a whole word and not the inside of a suffixed one', () => {
      // \b would fire at nearly every Sinhala character boundary; the exact
      // pass proves boundaries come from token spans instead.
      const found = findOccurrences([target('s1', text)], NAME_SI)
      expect(found).toHaveLength(1)
      expect(found[0].start).toBe(0)
      expect(found[0].matched).toBe(NAME_SI)
    })

    it('does not match the tail of a longer word', () => {
      // This used to report a match: isWordChar counted \p{L}/\p{N} only, and
      // Sinhala vowel signs are combining marks, so every consonant carrying
      // one began a fresh token and a term could align with the end of a
      // compound. Marks are word characters now, so "මහාශානික" is one token
      // and a search for the name inside it finds nothing — the same answer
      // English always gave for "megashanika".
      expect(findOccurrences([target('s1', `මහා${NAME_SI}`)], NAME_SI)).toEqual([])
      expect(findOccurrences([target('s1', 'megashanika')], 'shanika')).toEqual([])
    })

    it('matches an inflected form without swallowing its suffix', () => {
      // ශානිකගේ is the possessive. The match must cover the name and stop, so
      // that applying it leaves the ගේ standing — a replacement that ate the
      // suffix would turn "Shanika's report" into "Shanika report".
      const found = findOccurrences([target('s1', NAME_SI_POSSESSIVE)], NAME_SI, { fuzzy: true })
      expect(found).toHaveLength(1)
      expect(found[0].matched).toBe(NAME_SI)
      expect(found[0].start).toBe(0)
      expect(found[0].approximate).toBe(true)

      const { updated } = applyReplacements(
        [target('s1', NAME_SI_POSSESSIVE)],
        [{ targetId: 's1', start: found[0].start, matched: found[0].matched }],
        'ශානිකා',
      )
      expect(updated[0].text).toBe('ශානිකාගේ')
    })

    it('will not treat the front of an unrelated long word as an inflection', () => {
      // Five characters of suffix is the limit — see MAX_INFLECTION_CHARS.
      expect(
        findOccurrences([target('s1', `${NAME_SI}වත්තේගමගේ`)], NAME_SI, { fuzzy: true }),
      ).toEqual([])
    })

    it('offers a suffixed form only as an approximate match', () => {
      const found = findOccurrences([target('s1', text)], NAME_SI, { fuzzy: true })
      const suffixed = found.filter((o) => o.approximate)
      expect(suffixed).toHaveLength(1)
      expect(suffixed[0].start).toBe(text.indexOf(NAME_SI_POSSESSIVE))
      expect(suffixed[0].similarity).toBeLessThan(1)
      expect(found.filter((o) => !o.approximate).map((o) => o.start)).toEqual([0])
    })

    it('leaves an English term inside a Sinhala sentence alone', () => {
      const found = findOccurrences([target('s1', text)], 'report')
      expect(found.map((o) => o.matched)).toEqual(['report'])
    })
  })

  describe('near-miss names', () => {
    it('finds a one-edit misspelling of a seven-letter name', () => {
      const found = findOccurrences([target('s1', 'Shanaka joined late')], 'Shanika', { fuzzy: true })
      expect(found).toHaveLength(1)
      expect(found[0].matched).toBe('Shanaka')
      expect(found[0].approximate).toBe(true)
      expect(found[0].similarity).toBeCloseTo(1 - 1 / 7)
    })

    it('finds a dropped letter in a nine-letter name', () => {
      const found = findOccurrences([target('s1', 'Prabudda will check')], 'Prabuddha', { fuzzy: true })
      expect(found.map((o) => o.matched)).toEqual(['Prabudda'])
    })

    it('does not reach an unrelated word of the same length', () => {
      expect(findOccurrences([target('s1', 'the meeting ran long')], 'Shanika', { fuzzy: true })).toEqual(
        [],
      )
    })

    it('finds nothing approximate when fuzzy is off', () => {
      expect(findOccurrences([target('s1', 'Shanaka joined late')], 'Shanika')).toEqual([])
    })
  })

  describe('multi-word terms', () => {
    const text = 'the salary advance was approved; the advance on salary was not'

    it('matches consecutive words as one phrase', () => {
      const found = findOccurrences([target('s1', text)], 'salary advance')
      expect(found).toHaveLength(1)
      expect(found[0].start).toBe(text.indexOf('salary advance'))
      expect(found[0].matched).toBe('salary advance')
    })

    it('does not match the same words out of order or apart', () => {
      expect(findOccurrences([target('s1', 'advance salary')], 'salary advance')).toEqual([])
      expect(findOccurrences([target('s1', 'salary and advance')], 'salary advance')).toEqual([])
    })

    it('keeps the original spacing inside the matched span', () => {
      // Matching spans the source text between the first and last token, so
      // odd whitespace survives into `matched` — and is what gets replaced.
      const spaced = 'the salary  advance was approved'
      const found = findOccurrences([target('s1', spaced)], 'salary advance', { fuzzy: true })
      expect(found).toHaveLength(1)
      expect(found[0].matched).toBe('salary  advance')
      expect(found[0].approximate).toBe(true)
    })

    it('matches a phrase spanning a line break', () => {
      const wrapped = 'the salary\nadvance was approved'
      const found = findOccurrences([target('s1', wrapped)], 'salary advance', { fuzzy: true })
      expect(found.map((o) => o.matched)).toEqual(['salary\nadvance'])
    })

    it('finds a phrase in each target it appears in', () => {
      const found = findOccurrences(
        [target('s1', text), target('sum', 'salary advance approved', 'summary')],
        'salary advance',
      )
      expect(found.map((o) => o.targetId)).toEqual(['s1', 'sum'])
    })
  })
})

describe('applyReplacements', () => {
  const text = 'Shanika met Shanika and Shanika'
  const targets = [target('s1', text)]
  const selections = [0, 12, 24].map((start) => ({ targetId: 's1', start, matched: 'Shanika' }))

  it('applies every selection when the replacement is longer', () => {
    // The offset test: a longer replacement shifts everything after it, so an
    // ascending pass would land the second and third writes mid-word.
    const result = applyReplacements(targets, selections, 'Shanika Perera')
    expect(result.applied).toBe(3)
    expect(result.skipped).toBe(0)
    expect(result.updated).toEqual([
      { id: 's1', text: 'Shanika Perera met Shanika Perera and Shanika Perera' },
    ])
  })

  it('applies every selection when the replacement is shorter', () => {
    const result = applyReplacements(targets, selections, 'Shan')
    expect(result.updated).toEqual([{ id: 's1', text: 'Shan met Shan and Shan' }])
    expect(result.applied).toBe(3)
  })

  it('does not depend on the order selections arrive in', () => {
    const shuffled = [selections[2], selections[0], selections[1]]
    expect(applyReplacements(targets, shuffled, 'Shanika Perera')).toEqual(
      applyReplacements(targets, selections, 'Shanika Perera'),
    )
  })

  it('leaves the input targets untouched', () => {
    applyReplacements(targets, selections, 'Shanika Perera')
    expect(targets[0].text).toBe(text)
  })

  it('replaces adjacent occurrences without eating the separator', () => {
    const adjacent = [target('s1', 'Shanika Shanika')]
    const result = applyReplacements(
      adjacent,
      [
        { targetId: 's1', start: 0, matched: 'Shanika' },
        { targetId: 's1', start: 8, matched: 'Shanika' },
      ],
      'Kasun',
    )
    expect(result.updated[0].text).toBe('Kasun Kasun')
  })

  describe('stale selections', () => {
    it('skips one whose text has moved and still applies the rest', () => {
      // The note was edited between finding and applying: writing at the old
      // offset would overwrite whatever moved into it.
      const result = applyReplacements(
        targets,
        [selections[0], { targetId: 's1', start: 12, matched: 'Shanaka' }],
        'Kasun',
      )
      expect(result.applied).toBe(1)
      expect(result.skipped).toBe(1)
      expect(result.updated).toEqual([{ id: 's1', text: 'Kasun met Shanika and Shanika' }])
    })

    it('writes nothing at all when every selection is stale', () => {
      const result = applyReplacements(
        targets,
        selections.map((s) => ({ ...s, matched: 'Shanaka' })),
        'Kasun',
      )
      expect(result).toEqual({ updated: [], applied: 0, skipped: 3 })
    })

    it('treats an offset past the end of the text as stale', () => {
      const result = applyReplacements(
        targets,
        [{ targetId: 's1', start: text.length + 5, matched: 'Shanika' }],
        'Kasun',
      )
      expect(result).toEqual({ updated: [], applied: 0, skipped: 1 })
    })

    it('drops a selection for a target it was not given', () => {
      // Neither applied nor skipped — callers that report a skipped count to a
      // person must derive it from what they sent, not from `skipped` alone.
      const result = applyReplacements(targets, [{ targetId: 'gone', start: 0, matched: 'Shanika' }], 'Kasun')
      expect(result).toEqual({ updated: [], applied: 0, skipped: 0 })
    })
  })

  it('returns only the targets it changed', () => {
    const many = [target('s1', text), target('s2', 'Shanika elsewhere'), target('s3', 'nothing here')]
    const result = applyReplacements(many, [selections[0]], 'Kasun')
    expect(result.updated.map((row) => row.id)).toEqual(['s1'])
  })

  it('applies across several targets at once', () => {
    const many = [target('s1', 'Shanika ships it'), target('sum', 'Shanika owns the report', 'summary')]
    const result = applyReplacements(
      many,
      [
        { targetId: 's1', start: 0, matched: 'Shanika' },
        { targetId: 'sum', start: 0, matched: 'Shanika' },
      ],
      'Kasun',
    )
    expect(result.applied).toBe(2)
    expect(result.updated).toEqual([
      { id: 's1', text: 'Kasun ships it' },
      { id: 'sum', text: 'Kasun owns the report' },
    ])
  })

  it('does nothing when nothing was selected', () => {
    expect(applyReplacements(targets, [], 'Kasun')).toEqual({ updated: [], applied: 0, skipped: 0 })
  })

  it('carries a find straight through to a correct rewrite', () => {
    const source = [
      target('s1', `${NAME_SI} අද වැඩ කළා. ${NAME_SI} report එක ලැබුණා.`),
      target('sum', `${NAME_SI} ships the report`, 'summary'),
    ]
    const found = findOccurrences(source, NAME_SI)
    const result = applyReplacements(source, found, 'ශනිකා')
    expect(result.applied).toBe(found.length)
    expect(result.skipped).toBe(0)
    for (const row of result.updated) {
      expect(row.text).not.toContain(NAME_SI)
      expect(row.text).toContain('ශනිකා')
    }
  })
})

describe('groupOccurrences', () => {
  function occurrencesFor(targets: SearchTarget[]): Occurrence[] {
    return findOccurrences(targets, 'Shanika')
  }

  it('makes one group per target even when two share a label', () => {
    const groups = groupOccurrences(
      occurrencesFor([
        target('s1', 'Shanika spoke', 'segment', 'Kasun'),
        target('s2', 'Shanika again, Shanika', 'segment', 'Kasun'),
      ]),
    )
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Kasun', 1],
      ['Kasun', 2],
    ])
  })

  it('names a group after its kind when the target has no label', () => {
    const groups = groupOccurrences(
      occurrencesFor([
        target('sum', 'Shanika owns it', 'summary'),
        target('a1', 'Shanika to send it', 'action'),
        target('t1', 'Shanika said so', 'transcript'),
        target('s1', 'Shanika wrote it', 'segment'),
      ]),
    )
    expect(groups.map((g) => g.label)).toEqual(['Summary', 'Action item', 'Transcript', 'Note'])
  })

  it('keeps targets and their items in the order they were found', () => {
    const text = 'Shanika, then Shanika'
    const groups = groupOccurrences(
      occurrencesFor([target('s2', text), target('s1', 'Shanika')]),
    )
    expect(groups.map((g) => g.kind)).toEqual(['segment', 'segment'])
    expect(groups[0].items.map((o) => o.start)).toEqual([0, text.indexOf('then Shanika') + 5])
  })

  it('groups nothing into nothing', () => {
    expect(groupOccurrences([])).toEqual([])
  })
})

describe('diffSingleWord', () => {
  it('reports the one word that changed', () => {
    expect(diffSingleWord('Sanjeewa will ship it', 'Sanjeeva will ship it')).toEqual({
      from: 'Sanjeewa',
      to: 'Sanjeeva',
    })
  })

  it('catches a capitalisation fix — the correction most worth propagating', () => {
    expect(diffSingleWord('ask sanjeewa first', 'ask Sanjeewa first')).toEqual({
      from: 'sanjeewa',
      to: 'Sanjeewa',
    })
  })

  it('sees through punctuation, which is not a token', () => {
    expect(diffSingleWord('Nuwan, please review.', 'Nuwarn, please review.')).toEqual({
      from: 'Nuwan',
      to: 'Nuwarn',
    })
  })

  it('works in Sinhala script', () => {
    expect(diffSingleWord('අපි හෙට කතා කරමු', 'අපි හෙට කථා කරමු')).toEqual({
      from: 'කතා',
      to: 'කථා',
    })
  })

  it('declines a rewritten sentence — two words moved, so no single term', () => {
    expect(diffSingleWord('we ship on Friday', 'we release on Monday')).toBeNull()
  })

  it('declines when words were added or removed', () => {
    expect(diffSingleWord('ship it', 'ship it today')).toBeNull()
    expect(diffSingleWord('ship it today', 'ship it')).toBeNull()
  })

  it('declines an unchanged edit', () => {
    expect(diffSingleWord('ship it  today', 'ship it today')).toBeNull()
  })

  it('declines a one-character term that would match half the transcript', () => {
    expect(diffSingleWord('option a is better', 'option b is better')).toBeNull()
  })

  it('declines empty text', () => {
    expect(diffSingleWord('', 'hello')).toBeNull()
  })
})

describe('normalizeSelectedTerm', () => {
  it('takes a plain word as-is', () => {
    expect(normalizeSelectedTerm('Ultravision')).toBe('Ultravision')
  })

  it('drops the trailing space a double-click adds', () => {
    expect(normalizeSelectedTerm('Ultravision ')).toBe('Ultravision')
  })

  it('drops punctuation a drag stopped inside', () => {
    expect(normalizeSelectedTerm('“Ultravision,”')).toBe('Ultravision')
    expect(normalizeSelectedTerm('  (Ampitiya).  ')).toBe('Ampitiya')
  })

  it('keeps a Sinhala word whole, vowel signs and all', () => {
    // The failure this guards: a punctuation-list trim cuts ශානිකගේ at ා, and
    // the search then goes looking for half a name.
    expect(normalizeSelectedTerm(' ශානිකගේ ')).toBe('ශානිකගේ')
    expect(normalizeSelectedTerm('කතා.')).toBe('කතා')
  })

  it('keeps what sits between the words of a phrase', () => {
    expect(normalizeSelectedTerm('test.ultravision.lk')).toBe('test.ultravision.lk')
    expect(normalizeSelectedTerm('ECC RAM')).toBe('ECC RAM')
  })

  it('accepts a phrase up to the word limit and refuses one past it', () => {
    const four = Array.from({ length: MAX_SELECTED_WORDS }, (_, i) => `word${i}`).join(' ')
    expect(normalizeSelectedTerm(four)).toBe(four)
    expect(normalizeSelectedTerm(`${four} more`)).toBeNull()
  })

  it('refuses a selection that crosses a line', () => {
    expect(normalizeSelectedTerm('Ultravision\nAmpitiya')).toBeNull()
    expect(normalizeSelectedTerm('Ultravision\r\nAmpitiya')).toBeNull()
  })

  it('refuses a selection with no word in it', () => {
    expect(normalizeSelectedTerm('')).toBeNull()
    expect(normalizeSelectedTerm('   ')).toBeNull()
    expect(normalizeSelectedTerm(' — ,. ')).toBeNull()
  })

  it('refuses a single character — it would match half the transcript', () => {
    expect(normalizeSelectedTerm('a')).toBeNull()
    expect(normalizeSelectedTerm(' a. ')).toBeNull()
  })

  it('refuses a term longer than the server would accept', () => {
    expect(normalizeSelectedTerm('x'.repeat(MAX_TERM_CHARS))).toHaveLength(MAX_TERM_CHARS)
    expect(normalizeSelectedTerm('x'.repeat(MAX_TERM_CHARS + 1))).toBeNull()
  })

  it('hands findOccurrences something it can actually match', () => {
    const targets = [target('s1', 'Ampitiya node replicates to Ampitiya, always.')]
    const term = normalizeSelectedTerm('“Ampitiya,”')
    expect(term).not.toBeNull()
    expect(findOccurrences(targets, term as string)).toHaveLength(2)
  })
})

describe('the case this feature exists for', () => {
  // Straight out of a real write-up: the model heard the same company name two
  // ways, once per language half, and the English half is the one that reads
  // correctly. Nobody may edit a transcript turn, so highlighting the wrong
  // spelling in the Sinhala half is the ONLY way to reach this correction.
  const summary = [
    'Nodes at Ultravision and Ampitiya replicate to each other.',
    'Rahumat to create test.ultravision.lk as a testing subdomain.',
    'Altavision සහ Ampitiya ස්ථාන අතර automatic failover සකස් කිරීමට තීරණය විය.',
  ].join('\n')

  it('reaches the misheard spelling in the other language half', () => {
    const term = normalizeSelectedTerm('Altavision ')
    expect(term).toBe('Altavision')

    const hits = findOccurrences([target('summary:m1', summary, 'summary')], term as string, {
      fuzzy: true,
    })
    // Its own mention plus the two correct ones it is a mis-hearing of — every
    // one shown in its sentence, and the approximate ones unticked by default.
    expect(hits.map((h) => h.matched)).toEqual(['Ultravision', 'ultravision', 'Altavision'])
    expect(hits.filter((h) => h.approximate).map((h) => h.matched)).toEqual([
      'Ultravision',
      'ultravision',
    ])
  })

  it('applies only what was ticked, leaving the subdomain alone', () => {
    const targets = [target('summary:m1', summary, 'summary')]
    const start = summary.indexOf('Altavision')
    const { updated, applied, skipped } = applyReplacements(
      targets,
      [{ targetId: 'summary:m1', start, matched: 'Altavision' }],
      'Ultravision',
    )
    expect({ applied, skipped }).toEqual({ applied: 1, skipped: 0 })
    expect(updated[0].text).toContain('Ultravision සහ Ampitiya')
    // The hostname is lowercase and was never ticked — a blind replace-all
    // would have rewritten it into a URL that does not resolve.
    expect(updated[0].text).toContain('test.ultravision.lk')
  })
})
