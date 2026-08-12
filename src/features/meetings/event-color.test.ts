import { describe, expect, it } from 'vitest'
import {
  EVENT_COLOR_COUNT,
  eventColorClasses,
  eventColorSlot,
  eventDotClasses,
} from './event-color'

const APP_A = '11111111-1111-4111-8111-111111111111'
const APP_B = '22222222-2222-4222-8222-222222222222'

describe('eventColorSlot', () => {
  it('gives no hue to a meeting with no app', () => {
    expect(eventColorSlot(null)).toBeNull()
    expect(eventColorSlot(undefined)).toBeNull()
    expect(eventColorSlot('')).toBeNull()
  })

  it('is stable for the same id — the whole point of hashing over indexing', () => {
    expect(eventColorSlot(APP_A)).toBe(eventColorSlot(APP_A))
  })

  it('always lands inside the palette', () => {
    for (let i = 0; i < 200; i += 1) {
      const slot = eventColorSlot(`app-${i}`)
      expect(slot).not.toBeNull()
      expect(slot).toBeGreaterThanOrEqual(1)
      expect(slot).toBeLessThanOrEqual(EVENT_COLOR_COUNT)
    }
  })

  it('spreads uuids across every slot rather than clustering', () => {
    // The naive `charCodeAt(0) % 8` this replaced put all hex-leading uuids
    // into a handful of slots. Over a realistic number of apps, every slot
    // should get used.
    const seen = new Set<number>()
    for (let i = 0; i < 400; i += 1) {
      const id = `${i.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`
      seen.add(eventColorSlot(id) as number)
    }
    expect(seen.size).toBe(EVENT_COLOR_COUNT)
  })

  it('does not collapse ids that differ only in their last character', () => {
    // uuids share long prefixes; a hash that stopped early would give these
    // the same colour and make two apps indistinguishable on the grid.
    const slots = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((suffix) => eventColorSlot(`app-prefix-${suffix}`)),
    )
    expect(slots.size).toBeGreaterThan(1)
  })
})

describe('eventColorClasses', () => {
  it('returns null for an app-less meeting so callers keep the neutral tone', () => {
    expect(eventColorClasses(null)).toBeNull()
    expect(eventDotClasses(null)).toBeNull()
  })

  it('returns literal classes Tailwind can find in the source', () => {
    const classes = eventColorClasses(APP_A)
    expect(classes).toMatch(/^border-l-event-[1-8] bg-event-[1-8]\/12 text-foreground$/)
    expect(eventDotClasses(APP_B)).toMatch(/^bg-event-[1-8]$/)
  })

  it('uses one hue consistently within a single class string', () => {
    for (const id of [APP_A, APP_B, 'app-x', 'app-y']) {
      const classes = eventColorClasses(id) as string
      const slots = [...classes.matchAll(/event-([1-8])/g)].map((m) => m[1])
      expect(new Set(slots).size).toBe(1)
    }
  })

  it('agrees with the dot helper — one app, one colour everywhere', () => {
    const slot = eventColorSlot(APP_A)
    expect(eventColorClasses(APP_A)).toContain(`event-${slot}`)
    expect(eventDotClasses(APP_A)).toBe(`bg-event-${slot}`)
  })
})
