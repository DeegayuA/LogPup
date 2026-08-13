import { describe, expect, it } from 'vitest'
import {
  EVENT_COLOR_COUNT,
  eventColorClasses,
  eventColorSlot,
  eventDotClasses,
  eventFadedClasses,
  eventSolidClasses,
  meetingColorKey,
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

describe('meetingColorKey', () => {
  it('ignores attendee order — the same people are the same team', () => {
    const a = meetingColorKey({ attendees: [{ id: 'u2' }, { id: 'u1' }, { id: 'u3' }] })
    const b = meetingColorKey({ attendees: [{ id: 'u1' }, { id: 'u3' }, { id: 'u2' }] })
    expect(a).toBe(b)
  })

  it('so two meetings of one crew land on one slot', () => {
    const standup = meetingColorKey({ attendees: [{ id: 'u1' }, { id: 'u2' }] })
    const retro = meetingColorKey({ attendees: [{ id: 'u2' }, { id: 'u1' }] })
    expect(eventColorSlot(standup)).toBe(eventColorSlot(retro))
  })

  it('distinguishes different sets', () => {
    expect(meetingColorKey({ attendees: [{ id: 'u1' }] })).not.toBe(
      meetingColorKey({ attendees: [{ id: 'u2' }] }),
    )
  })

  it('falls back to the app, then to neutral', () => {
    expect(meetingColorKey({ attendees: [], appId: APP_A })).toBe(APP_A)
    expect(meetingColorKey({ attendees: [] })).toBeNull()
    expect(meetingColorKey({})).toBeNull()
  })
})

describe('solid and faded pill classes', () => {
  it('returns literal classes Tailwind can find, with inverted text on solids', () => {
    const key = meetingColorKey({ attendees: [{ id: 'u1' }, { id: 'u2' }] }) as string
    expect(eventSolidClasses(key)).toMatch(/^border-event-[1-8] bg-event-[1-8] text-background$/)
    expect(eventFadedClasses(key)).toMatch(
      /^border-transparent bg-event-[1-8]\/20 text-muted-foreground$/,
    )
  })

  it('keeps one hue across solid, faded and dot for the same key', () => {
    const key = meetingColorKey({ attendees: [{ id: 'u9' }] }) as string
    const slot = eventColorSlot(key)
    expect(eventSolidClasses(key)).toContain(`event-${slot}`)
    expect(eventFadedClasses(key)).toContain(`event-${slot}`)
  })

  it('returns null for a keyless meeting so callers keep the neutral chip', () => {
    expect(eventSolidClasses(null)).toBeNull()
    expect(eventFadedClasses(null)).toBeNull()
  })
})
