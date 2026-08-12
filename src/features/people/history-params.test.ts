import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMPARE_WINDOW,
  historyHref,
  parseHistoryParams,
  resolveHistoryWindow,
} from './history-params'

const NOW = new Date('2026-08-12T06:00:00Z') // 11:30 in Asia/Colombo

describe('parseHistoryParams', () => {
  it('defaults everything on an empty query string', () => {
    expect(parseHistoryParams({})).toEqual({
      at: undefined,
      window: DEFAULT_COMPARE_WINDOW,
      view: 'people',
      q: '',
      movedOnly: false,
    })
  })

  it('reads valid values', () => {
    expect(
      parseHistoryParams({ at: '2026-01-05', window: '7', view: 'apps', q: ' Anu ', moved: '1' }),
    ).toEqual({
      at: '2026-01-05',
      window: 7,
      view: 'apps',
      q: 'Anu',
      movedOnly: true,
    })
  })

  it('falls back rather than throwing on junk', () => {
    // These arrive from bookmarks and hand-edited URLs — a 500 here would be
    // a page nobody can recover from without clearing the address bar.
    const parsed = parseHistoryParams({ window: '13', view: 'sideways', moved: 'yes' })
    expect(parsed.window).toBe(DEFAULT_COMPARE_WINDOW)
    expect(parsed.view).toBe('people')
    expect(parsed.movedOnly).toBe(false)
  })

  it('caps the free-text filter', () => {
    expect(parseHistoryParams({ q: 'x'.repeat(200) }).q).toHaveLength(60)
  })
})

describe('resolveHistoryWindow', () => {
  it('puts `from` a whole window before the as-of day', () => {
    const params = parseHistoryParams({ at: '2026-03-15', window: '7' })
    const { asOf, fromIso, from } = resolveHistoryWindow(params, NOW)

    expect(asOf.iso).toBe('2026-03-15')
    expect(fromIso).toBe('2026-03-08')
    // Both edges land on the END of their day, so the window is day-aligned
    // in the business timezone rather than at an arbitrary instant.
    expect(from.getTime()).toBeLessThan(asOf.at.getTime())
  })

  it('follows the as-of clamp when the date is today', () => {
    const { asOf } = resolveHistoryWindow(parseHistoryParams({}), NOW)
    expect(asOf.isToday).toBe(true)
  })
})

describe('historyHref', () => {
  const base = parseHistoryParams({})

  it('omits every default so the canonical link is bare', () => {
    expect(historyHref(base, {}, NOW)).toBe('/people/history')
  })

  it('sets only what differs from the defaults', () => {
    expect(historyHref(base, { view: 'apps' }, NOW)).toBe('/people/history?view=apps')
    expect(historyHref(base, { window: 7 }, NOW)).toBe('/people/history?window=7')
    expect(historyHref(base, { movedOnly: true }, NOW)).toBe('/people/history?moved=1')
  })

  it('drops `at` when it is today', () => {
    const today = parseHistoryParams({ at: '2026-08-12' })
    expect(historyHref(today, {}, NOW)).toBe('/people/history')
  })

  it('keeps a past `at` and combines params', () => {
    const params = parseHistoryParams({ at: '2026-01-05', window: '90', view: 'changes' })
    expect(historyHref(params, {}, NOW)).toBe('/people/history?at=2026-01-05&window=90&view=changes')
  })

  it('escapes the free-text filter', () => {
    expect(historyHref(base, { q: 'a b&c' }, NOW)).toBe('/people/history?q=a+b%26c')
  })
})
