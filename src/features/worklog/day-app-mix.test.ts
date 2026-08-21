import { describe, expect, it } from 'vitest'
import { MAX_MIX_SEGMENTS, buildDayMix, buildMixLegend, type DayEntry } from './day-app-mix'

const entry = (appId: string | null, appName: string | null, minutes: number): DayEntry => ({
  appId,
  appName,
  minutes,
})

describe('buildDayMix', () => {
  it('groups a day by project and orders it heaviest first', () => {
    const mix = buildDayMix([
      entry('a', 'Apollo', 60),
      entry('k', 'Kestrel', 180),
      entry('a', 'Apollo', 60),
    ])
    expect(mix.map((s) => [s.label, s.minutes])).toEqual([
      ['Kestrel', 180],
      ['Apollo', 120],
    ])
  })

  it('gives shares that sum to one, so the bar always fills its width', () => {
    const mix = buildDayMix([entry('k', 'Kestrel', 90), entry('a', 'Apollo', 30)])
    expect(mix.map((s) => s.share)).toEqual([0.75, 0.25])
    expect(mix.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1)
  })

  it('keeps unassigned time as its own segment with NO project id', () => {
    // Admin, learning and interviews genuinely belong to no project. Giving
    // that time a hue would invent a project for it.
    const mix = buildDayMix([entry('k', 'Kestrel', 60), entry(null, null, 60)])
    const unassigned = mix.find((s) => s.label === 'Unassigned')
    expect(unassigned).toBeDefined()
    expect(unassigned?.appId).toBeNull()
  })

  it('does not fold a nameless PROJECT in with unassigned time', () => {
    // A project whose name did not come back is still that project's time — it
    // keeps its own identity, and therefore its own hue.
    const mix = buildDayMix([entry('k', null, 60), entry(null, null, 60)])
    expect(mix.map((s) => s.label).sort()).toEqual(['Project', 'Unassigned'])
    expect(mix.find((s) => s.label === 'Project')?.appId).toBe('k')
  })

  it('merges the tail once a day has more projects than a cell can show', () => {
    const mix = buildDayMix([
      entry('a', 'Apollo', 100),
      entry('b', 'Bravo', 80),
      entry('c', 'Charlie', 60),
      entry('d', 'Delta', 40),
      entry('e', 'Echo', 20),
    ])
    expect(mix).toHaveLength(MAX_MIX_SEGMENTS + 1)
    const last = mix[mix.length - 1]
    // Counted, because "Other" with no number tells the reader nothing.
    expect(last.label).toBe('Other projects (2)')
    expect(last.minutes).toBe(60)
    expect(mix.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1)
  })

  it('does not merge when the projects exactly fill the cell', () => {
    const mix = buildDayMix([
      entry('a', 'Apollo', 30),
      entry('b', 'Bravo', 20),
      entry('c', 'Charlie', 10),
    ])
    expect(mix).toHaveLength(MAX_MIX_SEGMENTS)
    expect(mix.every((s) => !s.label.startsWith('Other'))).toBe(true)
  })

  it('breaks a tie on label, so equal minutes never reshuffle between renders', () => {
    const mix = buildDayMix([entry('z', 'Zeta', 60), entry('a', 'Alpha', 60)])
    expect(mix.map((s) => s.label)).toEqual(['Alpha', 'Zeta'])
  })

  it('is empty for a day with no minutes, rather than a zero-width bar', () => {
    expect(buildDayMix([])).toEqual([])
    expect(buildDayMix([entry('k', 'Kestrel', 0)])).toEqual([])
  })

  it('ignores zero-minute entries instead of skewing the shares', () => {
    const mix = buildDayMix([entry('k', 'Kestrel', 60), entry('a', 'Apollo', 0)])
    expect(mix.map((s) => s.label)).toEqual(['Kestrel'])
    expect(mix[0].share).toBe(1)
  })
})

describe('buildMixLegend', () => {
  it('lists each project once, heaviest first', () => {
    const legend = buildMixLegend([
      entry('a', 'Apollo', 30),
      entry('k', 'Kestrel', 90),
      entry('a', 'Apollo', 30),
    ])
    expect(legend.map((l) => [l.label, l.minutes])).toEqual([
      ['Kestrel', 90],
      ['Apollo', 60],
    ])
  })

  it('leaves unassigned time out — it has no hue to explain', () => {
    const legend = buildMixLegend([entry(null, null, 120), entry('k', 'Kestrel', 30)])
    expect(legend.map((l) => l.label)).toEqual(['Kestrel'])
  })

  it('is empty when nothing on screen carries a project', () => {
    expect(buildMixLegend([entry(null, null, 60)])).toEqual([])
  })
})
