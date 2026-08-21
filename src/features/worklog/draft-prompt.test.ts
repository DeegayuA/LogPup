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

describe('buildWorklogDraftPrompt — per-project role', () => {
  const base = {
    name: 'Prabuddha',
    day: '2026-08-20',
    activity: [
      {
        verb: 'attended',
        entityType: 'meeting',
        entityLabel: 'Sprint 14 check-in',
        appName: 'Kestrel',
      },
    ],
  }

  it('is byte-for-byte unchanged when no roles are supplied', () => {
    // Every existing caller must keep the prompt it has today — a silent
    // change to a prompt is a silent change to everyone's drafts.
    expect(buildWorklogDraftPrompt({ ...base, roles: [] })).toBe(
      buildWorklogDraftPrompt(base),
    )
    expect(buildWorklogDraftPrompt({ ...base, roles: undefined })).toBe(
      buildWorklogDraftPrompt(base),
    )
  })

  it('names the role per project, not per person', () => {
    const prompt = buildWorklogDraftPrompt({
      ...base,
      roles: [
        { appName: 'Kestrel', tone: 'reviewer' },
        { appName: 'Apollo', tone: 'member' },
      ],
    })
    expect(prompt).toContain('Kestrel: they lead and review on it')
    expect(prompt).toContain('Apollo: they are hands-on')
  })

  it('reads a manager and a lead as people-work, never as a ticket list', () => {
    for (const tone of ['manager', 'reviewer'] as const) {
      const prompt = buildWorklogDraftPrompt({ ...base, roles: [{ appName: 'Kestrel', tone }] })
      expect(prompt).toMatch(/meetings/)
    }
  })

  it('keeps the invention ban dominant over the role framing', () => {
    // "You are a lead" is exactly the framing a model will embroider into
    // leadership-sounding work nobody recorded, so the role rule has to say
    // what it does NOT license, in the same prompt.
    const prompt = buildWorklogDraftPrompt({
      ...base,
      roles: [{ appName: 'Kestrel', tone: 'reviewer' }],
    })
    expect(prompt).toContain('NEVER invent work')
    expect(prompt).toContain('changes what to LEAD WITH, never what to include')
    expect(prompt).toContain('Do NOT add leadership, delivery or outcome language')
  })
})
