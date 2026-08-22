import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  ENTITY_KINDS,
  MENTION_SOURCES,
  entityKindForSource,
  isMentionSource,
} from './entity-kinds'

/**
 * One vocabulary, enforced.
 *
 * The failure this guards is invisible: a join on `'app_comment' = 'comment'`
 * matches no rows, throws nothing, and renders as "nobody has mentioned you"
 * forever. Nothing about that looks like a bug from the outside, which is why
 * the check has to be here rather than in whatever surface notices it last.
 */

describe('every mention source is about a known entity', () => {
  it('maps all of them, and to nothing invented', () => {
    for (const source of MENTION_SOURCES) {
      expect(ENTITY_KINDS).toContain(entityKindForSource(source))
    }
  })

  it('recognises its own values and rejects a near-miss', () => {
    expect(isMentionSource('app_comment')).toBe(true)
    // The exact drift this file exists to prevent: activity_log says
    // 'comment', a mention says 'app_comment', and one of them is wrong
    // wherever the two are compared.
    expect(isMentionSource('comment')).toBe(false)
    expect(isMentionSource('')).toBe(false)
  })
})

describe('the schema reads from this file rather than restating it', () => {
  it('the mentions table points at MENTION_SOURCES in its comment', () => {
    // A weak check on purpose — the column is `text`, so nothing stronger is
    // available at the type level. What it buys is that somebody widening the
    // column finds the pointer to the union instead of inventing a seventh
    // value in the migration.
    const schema = readFileSync('src/db/schema.ts', 'utf8')
    const table = schema.slice(schema.indexOf("pgTable('mentions'"))
    expect(table.slice(0, 2000)).toContain('MENTION_SOURCES')
  })

  it('activity_log documents the same vocabulary this file lists', () => {
    const schema = readFileSync('src/db/schema.ts', 'utf8')
    const activity = schema.slice(schema.indexOf("pgTable('activity_log'"))
    const header = activity.slice(0, 900)
    // Every entity kind activity_log's own comment names must be one this file
    // knows, or the two have already drifted.
    for (const kind of ['task', 'app', 'sprint', 'meeting', 'user', 'comment', 'followup']) {
      if (header.includes(`${kind} |`) || header.includes(`| ${kind}`)) {
        expect(ENTITY_KINDS).toContain(kind)
      }
    }
  })
})
