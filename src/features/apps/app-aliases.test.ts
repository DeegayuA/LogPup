import { describe, expect, it } from 'vitest'
import {
  appPromptLine,
  appVocabulary,
  deriveAcronyms,
  matchApp,
  type AliasedApp,
} from '@/features/apps/app-aliases'

/* The studio as it actually is: a client abbreviation nothing derives (SGX),
   a CamelCase name that derives its own (CareCode), a project people call by a
   prefix (Solarsim), and two siblings sharing a word (DERMS Web / Mobile). */
const APPS: AliasedApp[] = [
  { id: 'attendance', name: 'Attendance Web App', aliases: ['SGX', 'syntax genie'] },
  { id: 'carecode', name: 'CareCode', aliases: [] },
  { id: 'solarsim', name: 'Solarsim Portal', aliases: [] },
  { id: 'derms-web', name: 'DERMS Web App', aliases: [] },
  { id: 'derms-mobile', name: 'DERMS Mobile App', aliases: [] },
  { id: 'altavision', name: 'Altavision Management', aliases: ['AV'] },
]

const id = (text: string) => matchApp(text, APPS)?.app.id ?? null

describe('the abbreviations people actually type', () => {
  /* The three the studio named out loud. None is derivable from the app's own
     letters, which is the whole reason apps.aliases exists. */
  it('reaches a project through a stored alias', () => {
    expect(id('ML model for SGX 2h')).toBe('attendance')
    expect(id('2h AV dashboard tweaks')).toBe('altavision')
  })

  it('reaches a project through an alias written in any case', () => {
    expect(id('4h syntax genie fixes')).toBe('attendance')
    expect(id('4h Syntax Genie fixes')).toBe('attendance')
  })

  /* CareCode gives CC for free — nobody has to type an alias for it. */
  it('reaches a project through an acronym derived from its own name', () => {
    expect(id('1h CC deployment')).toBe('carecode')
    expect(id('1h AWA regression pass')).toBe('attendance')
  })

  /* "Solar app" for Solarsim. The word is not the name and not an alias; it is
     the front of the name, which is how people shorten things. */
  it('reaches a project through a unique prefix', () => {
    expect(id('2h bug fixes in Solar app')).toBe('solarsim')
    expect(id('Solarsim meeting prep')).toBe('solarsim')
  })
})

describe('what it refuses to match', () => {
  /* A lowercase "cc" mid-sentence is a mailing list, not CareCode. Attributing
     an afternoon to the wrong project is worse than attributing it to none,
     because nothing about the wrong one looks wrong later. */
  it('does not read a lowercase acronym out of ordinary prose', () => {
    expect(id('1h put marketing on cc for the release note')).toBeNull()
  })

  it('does not find an acronym inside a longer word', () => {
    expect(id('2h reconciled the account balances')).toBeNull()
  })

  /* DERMS Web and DERMS Mobile both start with "DERMS", so the prefix answers
     to two projects and therefore to neither. */
  it('refuses an ambiguous prefix rather than picking one', () => {
    expect(id('3h DERMS refactor')).toBeNull()
  })

  it('still resolves the ambiguous pair when the full name is written', () => {
    expect(id('3h DERMS Mobile App debug')).toBe('derms-mobile')
    expect(id('3h DERMS Web App debug')).toBe('derms-web')
  })

  /* Every project here is an "app". A matcher that let the word through would
     put the alphabetically-first project on every line in the studio. */
  it('never matches on a word every project shares', () => {
    expect(id('4h app work')).toBeNull()
    expect(id('2h portal changes')).toBeNull()
  })

  it('finds nothing in an empty line or an empty studio', () => {
    expect(matchApp('', APPS)).toBeNull()
    expect(matchApp('4h Solarsim', [])).toBeNull()
  })

  it('needs at least four characters before it will guess a prefix', () => {
    expect(id('2h Sol work')).toBeNull()
  })
})

/* THE PASTE THIS WHOLE FEATURE EXISTS FOR, fragment by fragment.
   Every line below is text somebody actually typed into the box. It is a
   regression test, not an illustration: each one of these silently recorded
   its hours against NO project before the tiers above existed. */
describe('the real four-day paste', () => {
  it('reads every project out of it', () => {
    expect(id('attendance app fixes (chamari, multi tenet) 4h')).toBe('attendance')
    expect(id('ML model for SGX 2h')).toBe('attendance')
    expect(id('bug fixes in Solar app 2h')).toBe('solarsim')
    // The typo, twice, in the two places the paste spells it wrong.
    expect(id('fixes in attendace app 4h')).toBe('attendance')
    expect(id('pr merge and fixes and development of attedance app')).toBe('attendance')
  })

  it('leaves the lines that name no project alone', () => {
    expect(id('monthly meeting 2h')).toBeNull()
    expect(id('documenting 2h')).toBeNull()
  })
})

describe('typos', () => {
  it('reaches the project through a missing letter', () => {
    expect(id('4h attendace fixes')).toBe('attendance')
  })

  it('reaches the project through a transposed letter', () => {
    expect(id('4h attendnace fixes')).toBe('attendance')
  })

  /* Below five characters an edit distance of one reaches most other short
     words in the language, and a project would start collecting hours from
     any sentence that rhymed with it. "card" is one letter from CareCode's
     first four and gets nothing. */
  it('will not guess a typo from a short word', () => {
    expect(id('2h card work')).toBeNull()
  })

  /* "care" is not a typo of anything — it is the front of CareCode, and the
     prefix tier claims it before this one runs, exactly as "Solar" claims
     Solarsim. Documented rather than prevented: the two are the same rule, and
     a matcher that took one and refused the other would be arbitrary. */
  it('leaves a genuine prefix to the prefix tier', () => {
    expect(matchApp('2h care work', APPS)).toEqual({
      app: APPS.find((a) => a.id === 'carecode'),
      how: 'prefix',
      matched: 'care',
    })
  })

  it('refuses when two projects are equally close', () => {
    const twins: AliasedApp[] = [
      { id: 'a', name: 'Marketing' },
      { id: 'b', name: 'Marketink' },
    ]
    expect(matchApp('2h marketirg work', twins)).toBeNull()
  })

  /* The tier is last for a reason: an exact name must never lose to a
     near-miss on a different project. */
  it('never beats an exact name elsewhere in the line', () => {
    expect(matchApp('2h attendace notes for CareCode', APPS)?.app.id).toBe('carecode')
  })
})

describe('longest wins inside a tier', () => {
  it('prefers the specific name over a shorter one it contains', () => {
    const apps: AliasedApp[] = [
      { id: 'derms', name: 'DERMS' },
      { id: 'derms-web', name: 'DERMS Web App' },
    ]
    expect(matchApp('2h DERMS Web App fixes', apps)?.app.id).toBe('derms-web')
  })

  it('prefers a name over a prefix guess', () => {
    expect(matchApp('2h Solarsim Portal and Solar work', APPS)?.how).toBe('name')
  })
})

describe('deriveAcronyms', () => {
  it('takes initials across meaningful words only', () => {
    expect(deriveAcronyms('Attendance Web App')).toContain('AWA')
    expect(deriveAcronyms('Solarsim Portal')).not.toContain('SP')
  })

  it('reads the capitals inside a CamelCase word', () => {
    expect(deriveAcronyms('CareCode')).toEqual(['CC'])
  })

  it('does not re-derive an all-caps name as its own acronym', () => {
    expect(deriveAcronyms('QAD')).toEqual([])
  })

  it('gives a single lowercase word nothing', () => {
    expect(deriveAcronyms('atutu')).toEqual([])
  })
})

describe('the prompt line', () => {
  it('carries the aliases and the derived acronyms beside the id', () => {
    const line = appPromptLine(APPS[0])
    expect(line).toContain('attendance')
    expect(line).toContain('Attendance Web App')
    expect(line).toContain('SGX')
    expect(line).toContain('AWA')
  })

  it('says nothing extra for a project with no other names', () => {
    expect(appPromptLine({ id: 'x', name: 'Atutu' })).toBe('- x — Atutu')
  })
})

describe('appVocabulary', () => {
  it('puts the longest term first, so the specific match is tried first', () => {
    expect(appVocabulary(APPS[0])[0]).toBe('Attendance Web App')
  })

  it('drops a duplicate alias whatever its case', () => {
    const terms = appVocabulary({ id: 'x', name: 'CareCode', aliases: ['carecode', 'CC'] })
    expect(terms).toEqual(['CareCode', 'CC'])
  })

  it('survives a blank alias somebody left in the field', () => {
    expect(appVocabulary({ id: 'x', name: 'Atutu', aliases: ['', '   '] })).toEqual(['Atutu'])
  })
})
