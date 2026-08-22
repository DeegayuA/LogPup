import { describe, expect, it } from 'vitest'
import {
  CATEGORY_WORDS,
  describeGrammar,
  describeLine,
  grammarForPrompt,
  lineIntent,
  lineSuggestions,
  parseDuration,
  parseEntryLine,
} from '@/features/worklog/entry-language'

const APPS = [
  { id: 'app-scada', name: 'SCADA | CEB Assist' },
  { id: 'app-unilever', name: 'Unilever Project' },
  { id: 'app-derms-web', name: 'DERMS Web App' },
  { id: 'app-derms-mobile', name: 'DERMS Mobile App' },
]
const TASKS = [{ id: 'task-1', name: 'Feeder model import' }]

const parse = (text: string) => parseEntryLine(text, { apps: APPS, tasks: TASKS })

describe('durations', () => {
  it('reads every spelling the help promises', () => {
    expect(parse('2h review').minutes).toBe(120)
    expect(parse('1.5h review').minutes).toBe(90)
    expect(parse('1h30 review').minutes).toBe(90)
    expect(parse('90m review').minutes).toBe(90)
    expect(parse('2 hours review').minutes).toBe(120)
    expect(parse('45 mins review').minutes).toBe(45)
  })

  // "1h30" must be tried before "1h" or the 30 vanishes — a total nobody can
  // explain a week later.
  it('does not drop the minutes half of 1h30', () => {
    expect(parse('1h30 on the importer').minutes).toBe(90)
    expect(parse('2h15 meeting').minutes).toBe(135)
  })

  it('takes a bare number as hours only at the start of the line', () => {
    expect(parse('2 reviewing the model').minutes).toBe(120)
  })

  /**
   * THE ONE THAT WOULD HAVE BILLED A CLIENT. A real note in this workspace
   * reads "Goodwe plant data extraction (5/10)". A bare number accepted
   * mid-sentence books five hours against work nobody timed.
   */
  it('ignores digits inside ordinary prose', () => {
    expect(parse('Goodwe plant data extraction (5/10)').minutes).toBeNull()
    expect(parse('revised my work log for 2026-08-11').minutes).toBeNull()
    expect(parse('reviewed 3 pull requests').minutes).toBeNull()
  })

  it('never invents a duration', () => {
    expect(parse('reviewed the feeder model').minutes).toBeNull()
    expect(parse('').minutes).toBeNull()
  })

  // Out of range reads as "no duration", so the person is asked rather than
  // the server refusing after the click.
  it('refuses a typo rather than logging a fifteen-hour day', () => {
    expect(parse('900h meeting').minutes).toBeNull()
    expect(parse('0h meeting').minutes).toBeNull()
  })
})

describe('kind', () => {
  it('recognises each category from its own words', () => {
    expect(parse('2h standup').category).toBe('meeting')
    expect(parse('2h reviewed the PR').category).toBe('review')
    expect(parse('2h debugging an outage').category).toBe('support')
    expect(parse('2h KT session').category).toBe('learning')
    expect(parse('2h timesheet and emails').category).toBe('admin')
    expect(parse('2h implemented the importer').category).toBe('task')
  })

  // Precedence is the rule when a line says two things. A review meeting is a
  // meeting; moving 'meeting' below 'review' in CATEGORY_WORDS flips this.
  it('lets the earlier category win when a line names two', () => {
    expect(parse('2h review meeting with the client').category).toBe('meeting')
    expect(parse('2h support call').category).toBe('meeting')
  })

  it('falls back to other, and says it did not match', () => {
    const result = parse('2h on the feeder thing')
    expect(result.categoryMatched).toBe(false)
    expect(result.category).toBe('other')
  })

  // Substrings must not match: "ktichen" is not a KT session, and "prompt"
  // is not a PR.
  it('matches whole words only', () => {
    expect(parse('2h prompt engineering').category).not.toBe('review')
    expect(parse('2h worked on the kitchen rota').categoryMatched).toBe(false)
  })
})

describe('projects and tasks', () => {
  it('attributes a named project', () => {
    const result = parse('2h reviewed the feeder model for SCADA | CEB Assist')
    expect(result.appId).toBe('app-scada')
    expect(result.category).toBe('review')
  })

  // A project whose name contains another's must resolve to the longer one.
  it('picks the most specific project name', () => {
    expect(parse('1h meeting about DERMS Mobile App').appId).toBe('app-derms-mobile')
    expect(parse('1h meeting about DERMS Web App').appId).toBe('app-derms-web')
  })

  // A named task is a reference to a real row; the words are a guess. The task
  // wins, and sends no appId because the server derives it from the task.
  it('lets a named task make it a task entry, and sends no project', () => {
    const result = parse('2h meeting about Feeder model import')
    expect(result.taskId).toBe('task-1')
    expect(result.category).toBe('task')
    expect(result.appId).toBeNull()
  })

  it('treats a bare project mention as project work rather than other', () => {
    const result = parse('3h Unilever Project')
    expect(result.appId).toBe('app-unilever')
    expect(result.category).toBe('other')
  })

  // "SCADA | CEB Assist" is real, and its pipe would make an unescaped pattern
  // an alternation matching almost anything.
  it('survives a project name full of regex metacharacters', () => {
    expect(parse('2h SCADA | CEB Assist').appId).toBe('app-scada')
    expect(parse('2h something unrelated').appId).toBeNull()
  })
})

describe('the note it keeps', () => {
  it('removes the duration and the connective, and keeps the prose', () => {
    expect(parse('2h on the feeder model').note).toBe('the feeder model')
    expect(parse('90m reviewing the importer').note).toBe('reviewing the importer')
    expect(parse('spent 2h fixing the CI').note).toBe('fixing the CI')
  })

  it('leaves a line with no duration completely alone', () => {
    expect(parse('reviewed the feeder model').note).toBe('reviewed the feeder model')
  })
})

/**
 * ONE SOURCE FOR THE GRAMMAR. The help panel and the model prompt are both
 * generated from CATEGORY_WORDS, so a word added to the parser is documented
 * and prompted for free — and, more to the point, a word REMOVED cannot linger
 * in help text promising something that no longer works.
 */
describe('the documented grammar is the implemented grammar', () => {
  it('describes every category the parser can return', () => {
    const described = describeGrammar().kinds.map((k) => k.label)
    expect(described).toEqual(CATEGORY_WORDS.map((g) => g.category))
  })

  it('puts real, working words in front of the model', () => {
    const prompt = grammarForPrompt()
    for (const group of CATEGORY_WORDS) {
      const first = group.words[0]
      expect(prompt).toContain(first)
      // and the word it advertises actually parses to that category
      expect(parse(`1h ${first}`).category).toBe(group.category)
    }
  })
})

/**
 * TWO DURATION GRAMMARS IN ONE FEATURE IS ONE TOO MANY.
 *
 * The Hours box has always parsed "1.5", "90m" and "1h30" via parseDuration.
 * This module grew its own reader for durations embedded in a sentence, and it
 * shipped with "90m" silently unparsed — the box accepted it, the sentence did
 * not, and nothing said so. They must agree on every form the help promises.
 */
describe('the sentence reader agrees with the Hours box', () => {
  it('reads every bare duration to the same number of minutes', () => {
    for (const form of ['2h', '1.5h', '1h30', '90m', '2 hours', '45 mins', '0.5h']) {
      expect(parseEntryLine(form).minutes, `"${form}"`).toBe(parseDuration(form))
    }
  })
})

/**
 * ONE FIELD FOR THE WHOLE DAY. The score, the hours, the project and the note
 * arrive in one sentence — so the parser has to keep the two halves of the day
 * apart while reading them from the same string.
 */
describe('the self-score', () => {
  it('reads a percent and keeps it out of the note', () => {
    const r = parse('80% shipped the importer')
    expect(r.percent).toBe(80)
    expect(r.note).toBe('shipped the importer')
  })

  /**
   * THE FIREWALL, IN THE GRAMMAR. percent is a JUDGEMENT and minutes are a
   * MEASUREMENT, and neither may be derived from the other. One token that
   * could mean either is that collapse by the back door, so a score REQUIRES
   * its sign — a bare number at the start has always meant hours.
   */
  it('will not read a bare number as a score', () => {
    // A bare leading number has always meant HOURS, so "8 shipped the
    // importer" is an eight-hour day, not an eight-percent one.
    expect(parse('8 shipped the importer').percent).toBeNull()
    expect(parse('8 shipped the importer').minutes).toBe(8 * 60)
    // And 80 of them is refused as a duration rather than quietly re-read as a
    // score — out of range stays out of range.
    expect(parse('80 shipped the importer').percent).toBeNull()
    expect(parse('80 shipped the importer').minutes).toBeNull()
  })

  it('reads a score and a duration from the same line, without confusing them', () => {
    const r = parse('80% 2h reviewed the feeder model for SCADA | CEB Assist')
    expect(r.percent).toBe(80)
    expect(r.minutes).toBe(120)
    expect(r.category).toBe('review')
    expect(r.appId).toBe('app-scada')
    expect(r.note).toBe('reviewed the feeder model for SCADA | CEB Assist')
  })

  it('refuses an impossible score rather than clamping it', () => {
    expect(parse('180% done').percent).toBeNull()
  })

  it('is null when the line says nothing about the plan', () => {
    expect(parse('2h review').percent).toBeNull()
  })
})

describe('what it shows back', () => {
  it('names every recognised piece, and calls the leftovers the note', () => {
    const tokens = describeLine(parse('80% 2h reviewed the feeder model for SCADA | CEB Assist'))
    expect(tokens.map((t) => t.kind)).toEqual(['score', 'time', 'project', 'category', 'note'])
  })

  it('says nothing about a category it did not actually recognise', () => {
    const tokens = describeLine(parse('2h on the thing'))
    expect(tokens.some((t) => t.kind === 'category')).toBe(false)
  })

  it('reports which half of the day the line would write', () => {
    expect(lineIntent(parse('80% good day'))).toMatchObject({ scores: true, logsHours: false })
    expect(lineIntent(parse('2h review'))).toMatchObject({ scores: false, logsHours: true })
    expect(lineIntent(parse('80% 2h review'))).toMatchObject({ scores: true, logsHours: true })
  })
})

describe('the suggestions', () => {
  it('offers only what the line is still missing', () => {
    const kinds = (text: string) =>
      new Set(lineSuggestions(parse(text), APPS).map((s) => s.kind))
    expect(kinds('')).toContain('score')
    expect(kinds('80%')).not.toContain('score')
    expect(kinds('2h')).not.toContain('time')
    expect(kinds('2h SCADA | CEB Assist')).not.toContain('project')
  })

  // A suggestion that does not parse to what its chip claims is worse than no
  // suggestion: the person taps "review" and gets a meeting.
  it('inserts text that actually parses back to what the chip says', () => {
    for (const s of lineSuggestions(parse(''), APPS)) {
      const round = parse(`1h ${s.text}`)
      if (s.kind === 'score') expect(round.percent).toBe(Number(s.label.replace('%', '')))
      if (s.kind === 'category') expect(round.category).toBe(s.label)
      if (s.kind === 'project') expect(round.appName).toBe(s.label)
    }
  })
})
