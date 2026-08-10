import { describe, it, expect } from 'vitest'
import { buildBlocks, type SprintExportData } from './export'

const data: SprintExportData = {
  appName: 'App', sprintName: 'S1', goal: 'Ship it',
  startDate: '2026-08-10', endDate: '2026-08-24',
  columns: [
    { heading: 'To do', items: [{ title: 'A', assignee: 'Sam' }] },
    { heading: 'Done', items: [{ title: 'B', assignee: null }] },
  ],
}

describe('buildBlocks', () => {
  it('starts with goal heading + paragraph', () => {
    const blocks = buildBlocks(data) as Array<Record<string, unknown>>
    expect(blocks[0]).toHaveProperty('heading_2')
    expect(JSON.stringify(blocks[1])).toContain('Ship it')
  })
  it('column heading includes count', () => {
    expect(JSON.stringify(buildBlocks(data))).toContain('To do (1)')
  })
  it('bullet shows title — assignee, or bare title', () => {
    const json = JSON.stringify(buildBlocks(data))
    expect(json).toContain('A — Sam')
    expect(json).toContain('"content":"B"')
  })
})
