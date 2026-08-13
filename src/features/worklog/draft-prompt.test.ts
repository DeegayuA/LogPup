import { describe, expect, it } from 'vitest'
import { buildWorklogDraftPrompt } from './draft-prompt'

const activity = [
  { verb: 'completed', entityType: 'task', entityLabel: 'Fix login redirect', appName: 'SCADA' },
  { verb: 'commented', entityType: 'meeting', entityLabel: 'Sprint planning', appName: null },
]

describe('buildWorklogDraftPrompt', () => {
  it('lists every activity row it was given', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity })
    expect(prompt).toContain('Fix login redirect')
    expect(prompt).toContain('Sprint planning')
  })

  it('carries the app name when there is one and omits it when there is not', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity })
    expect(prompt).toContain('Fix login redirect (SCADA)')
    expect(prompt).toContain('Sprint planning\n')
  })

  it('asks for first person and forbids inventing work', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity })
    expect(prompt.toLowerCase()).toContain('first person')
    expect(prompt.toLowerCase()).toContain('never invent')
  })

  it('names the person, so the draft is written as them rather than about them', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity })
    expect(prompt).toContain('Nadeesha')
  })

  it('says so plainly when there is no recorded activity', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity: [] })
    expect(prompt).toContain('no recorded activity')
    // and must not invite a summary of nothing
    expect(prompt.toLowerCase()).toContain('do not guess')
  })

  it('keeps technical and product names in Latin script for a bilingual team', () => {
    const prompt = buildWorklogDraftPrompt({ name: 'Nadeesha', day: '2026-08-13', activity })
    expect(prompt).toContain('Sinhala')
  })
})
