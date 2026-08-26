import { describe, it, expect } from 'vitest'
import { SNIPPET_CHARS, glanceAtDay } from './day-summary'

function glance(over: Partial<Parameters<typeof glanceAtDay>[0]> = {}) {
  return glanceAtDay({
    percent: null,
    note: null,
    loggedMinutes: 0,
    scheduledMinutes: null,
    entryCount: 0,
    ...over,
  })
}

describe('glanceAtDay', () => {
  it('calls an untouched day empty', () => {
    expect(glance().empty).toBe(true)
  })

  it('does not count a schedule as content', () => {
    // A schedule is something the workspace set, not something this person
    // recorded — a day nobody has touched must still read as untouched.
    expect(glance({ scheduledMinutes: 480 }).empty).toBe(true)
  })

  it('is non-empty once anything is recorded', () => {
    expect(glance({ percent: 50 }).empty).toBe(false)
    expect(glance({ note: 'shipped the parser' }).empty).toBe(false)
    expect(glance({ entryCount: 1, loggedMinutes: 90 }).empty).toBe(false)
  })

  it('reads hours against the schedule when there is one', () => {
    expect(glance({ loggedMinutes: 360, scheduledMinutes: 480 }).hours).toBe('6 of 8')
    expect(glance({ loggedMinutes: 360 }).hours).toBe('6')
  })

  it('has no hours phrase when nothing was logged', () => {
    // Not "0 of 8" — that reads as a failure to log rather than a day whose
    // hours simply are not the point.
    expect(glance({ scheduledMinutes: 480 }).hours).toBeNull()
  })

  it('skips a dangling project tag to find the line that says something', () => {
    // "Tag every unfilled project" writes bare markers on lines of their own.
    // Leading with one would describe somebody's Tuesday as "[Unilever Project]".
    const note = '[SCADA | CEB Assist]\n[Unilever Project]\nUpdated the feeder model'
    expect(glance({ note }).snippet).toBe('Updated the feeder model')
  })

  it('keeps a tag that sits on a line with real content', () => {
    const note = '[DERMS Mobile App] Complete smart plug registration flow'
    expect(glance({ note }).snippet).toBe('[DERMS Mobile App] Complete smart plug registration flow')
  })

  it('falls back to a tags-only note rather than showing nothing', () => {
    expect(glance({ note: '[Unilever Project]\n[LogPup]' }).snippet).toBe('[Unilever Project]')
  })

  it('ignores blank lines and surrounding whitespace', () => {
    expect(glance({ note: '\n\n   \n  shipped it  \n' }).snippet).toBe('shipped it')
  })

  it('has no snippet for an empty or whitespace-only note', () => {
    expect(glance({ note: '' }).snippet).toBeNull()
    expect(glance({ note: '   \n  ' }).snippet).toBeNull()
  })

  it('cuts a long line without splitting a Sinhala grapheme cluster', () => {
    // A raw slice lands mid-cluster and strands a bare consonant where
    // ව්‍යාපෘතිය used to be. The cut must never end on a dependent sign.
    const note = 'ව්‍යාපෘතිය සඳහා දත්ත ගබඩාව යාවත්කාලීන කරමින් සිටිමි '.repeat(6)
    const { snippet } = glance({ note })
    expect(snippet).not.toBeNull()
    expect((snippet as string).length).toBeLessThanOrEqual(SNIPPET_CHARS)
    expect(/[ංඃ්-ෟ‍]$/.test(snippet as string)).toBe(false)
  })

  it('passes a short line through untouched', () => {
    expect(glance({ note: 'shipped the parser' }).snippet).toBe('shipped the parser')
  })
})
