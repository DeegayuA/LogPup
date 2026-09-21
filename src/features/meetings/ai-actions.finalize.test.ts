import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Source-level guard, in the style of src/db/live.test.ts, because that file's
 * check 3 is FILE-scoped: ai-actions.ts mentions liveMeetings, so every
 * child-table read inside it is exempt. This pins the one read that check
 * cannot see and that a real person is sent to — "Analyze again" after
 * removing a take must not quote the removed take back into the minutes.
 */
const source = readFileSync(new URL('./ai-actions.ts', import.meta.url), 'utf8')

function functionBody(name: string): string {
  const start = source.indexOf(`async function ${name}(`)
  expect(start, `${name} exists`).toBeGreaterThan(-1)
  const rest = source.slice(start + 1)
  const next = rest.search(/\n(?:export )?async function /)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('finalizeMeetingRecordingInner reads segments through the live view', () => {
  it('never selects from the raw meetingRecordingSegments table', () => {
    const body = functionBody('finalizeMeetingRecordingInner')
    expect(body).toContain('.from(liveRecordingSegments)')
    expect(body).not.toMatch(/\.from\(\s*meetingRecordingSegments\s*\)/)
  })

  it('keeps fetchNextSegmentIndex on the raw table — a deleted take keeps its slot', () => {
    const body = functionBody('fetchNextSegmentIndex')
    expect(body).toMatch(/\.from\(\s*meetingRecordingSegments\s*\)/)
  })

  it('hands the removed indices to concatenateSegments, read from the deleted rows', () => {
    expect(functionBody('finalizeMeetingRecordingInner')).toContain('await fetchRemovedSegmentIndices(id)')
    const helper = functionBody('fetchRemovedSegmentIndices')
    expect(helper).toContain('isNotNull(meetingRecordingSegments.deletedAt)')
  })
})
