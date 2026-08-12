import { describe, expect, it } from 'vitest'
import {
  laneFraction,
  layoutOverlaps,
  overlapMap,
  type OverlapEvent,
} from './calendar-overlap'

/** 2026-08-12 at `h:m` Colombo, as epoch ms. The absolute value is irrelevant
 *  — the packer only ever compares numbers — but a real day keeps the cases
 *  readable. */
const at = (hour: number, minute = 0): number =>
  Date.UTC(2026, 7, 12, hour, minute) - 5.5 * 3_600_000

const event = (id: string, from: number, to: number): OverlapEvent => ({
  id,
  startMs: from,
  endMs: to,
})

/** `{ id: [lane, laneCount] }` — the whole result in one readable object. */
function placementsOf(events: OverlapEvent[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {}
  for (const placement of layoutOverlaps(events)) {
    out[placement.id] = [placement.lane, placement.laneCount]
  }
  return out
}

describe('layoutOverlaps', () => {
  it('gives every event the full width when nothing overlaps', () => {
    expect(
      placementsOf([
        event('a', at(9), at(10)),
        event('b', at(11), at(12)),
        event('c', at(14), at(15)),
      ]),
    ).toEqual({ a: [0, 1], b: [0, 1], c: [0, 1] })
  })

  it('does NOT cluster back-to-back meetings', () => {
    // 09:00–10:00 and 10:00–11:00 touch but never coexist, so neither loses
    // width. This is the case a naive closed-interval test gets wrong.
    expect(
      placementsOf([event('a', at(9), at(10)), event('b', at(10), at(11))]),
    ).toEqual({ a: [0, 1], b: [0, 1] })
  })

  it('splits two overlapping meetings in half', () => {
    const placements = placementsOf([
      event('a', at(9), at(10, 30)),
      event('b', at(10), at(11)),
    ])
    expect(placements).toEqual({ a: [0, 2], b: [1, 2] })
  })

  it('splits a three-way overlap in thirds', () => {
    expect(
      placementsOf([
        event('a', at(9), at(12)),
        event('b', at(9, 30), at(11)),
        event('c', at(10), at(10, 30)),
      ]),
    ).toEqual({ a: [0, 3], b: [1, 3], c: [2, 3] })
  })

  it('packs an A–B–C chain into TWO lanes, not three', () => {
    // A and C do not overlap each other; both overlap B. The documented rule
    // is first-free-lane packing with a cluster-uniform width, so A and C
    // share lane 0 and everything renders at half width with aligned edges.
    expect(
      placementsOf([
        event('a', at(9), at(10)),
        event('b', at(9, 30), at(10, 30)),
        event('c', at(10), at(11)),
      ]),
    ).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2] })
  })

  it('keeps a separate cluster at full width after a gap', () => {
    // Two overlapping in the morning, one alone in the afternoon: the
    // afternoon meeting must not be narrowed by a collision it is not in.
    expect(
      placementsOf([
        event('a', at(9), at(10)),
        event('b', at(9, 30), at(10, 30)),
        event('c', at(14), at(15)),
      ]),
    ).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] })
  })

  it('separates events with identical start and end', () => {
    expect(
      placementsOf([event('a', at(9), at(10)), event('b', at(9), at(10))]),
    ).toEqual({ a: [0, 2], b: [1, 2] })
  })

  it('is deterministic regardless of input order', () => {
    const events = [
      event('c', at(10), at(11)),
      event('a', at(9), at(10, 30)),
      event('b', at(9), at(10)),
    ]
    const forward = placementsOf(events)
    const reversed = placementsOf([...events].reverse())
    expect(reversed).toEqual(forward)
    // Same start: the LONGER meeting takes lane 0.
    expect(forward.a[0]).toBe(0)
    expect(forward.b[0]).toBe(1)
  })

  it('gives a zero-length event its own lane inside the meeting containing it', () => {
    // Half-open intervals alone would say a zero-length event collides with
    // nothing, hand it the full width, and paint it over the real meeting.
    expect(
      placementsOf([event('a', at(9), at(11)), event('z', at(10), at(10))]),
    ).toEqual({ a: [0, 2], z: [1, 2] })
  })

  it('leaves a lone zero-length event at full width', () => {
    expect(placementsOf([event('z', at(10), at(10))])).toEqual({ z: [0, 1] })
  })

  it('treats a zero-length event at another meeting’s end as adjacent', () => {
    expect(
      placementsOf([event('a', at(9), at(10)), event('z', at(10), at(10))]),
    ).toEqual({ a: [0, 1], z: [0, 1] })
  })

  it('handles two zero-length events at the same instant', () => {
    expect(
      placementsOf([event('y', at(10), at(10)), event('z', at(10), at(10))]),
    ).toEqual({ y: [0, 2], z: [1, 2] })
  })

  it('normalises an inverted range instead of disabling the overlap test', () => {
    // endsAt before startsAt can only come from a direct DB edit. It must not
    // make the event collide with nothing (full width, painted over its
    // neighbours) — it collapses to a point at its start.
    expect(
      placementsOf([event('a', at(9), at(11)), event('bad', at(10), at(8))]),
    ).toEqual({ a: [0, 2], bad: [1, 2] })
  })

  it('clusters meetings that span midnight by instant, not by day', () => {
    const lateTuesday = event('late', at(22), at(26)) // 22:00 → 02:00 Wednesday
    const earlyWednesday = event('early', at(25), at(27)) // 01:00 → 03:00
    const wednesdayMorning = event('morning', at(33), at(34)) // 09:00
    expect(placementsOf([lateTuesday, earlyWednesday, wednesdayMorning])).toEqual({
      late: [0, 2],
      early: [1, 2],
      morning: [0, 1],
    })
  })

  it('returns an empty list for no events', () => {
    expect(layoutOverlaps([])).toEqual([])
  })

  it('never reports a laneCount below 1', () => {
    for (const placement of layoutOverlaps([event('a', at(9), at(9))])) {
      expect(placement.laneCount).toBeGreaterThanOrEqual(1)
    }
  })

  it('uses exactly as many lanes as the cluster’s peak concurrency', () => {
    // Four meetings, but never more than two at once — so two lanes.
    const placements = placementsOf([
      event('a', at(9), at(10)),
      event('b', at(9, 30), at(10, 30)),
      event('c', at(10), at(11)),
      event('d', at(10, 30), at(11, 30)),
    ])
    expect(new Set(Object.values(placements).map(([, count]) => count))).toEqual(new Set([2]))
  })
})

describe('overlapMap', () => {
  it('keys the placements by id', () => {
    const map = overlapMap([event('a', at(9), at(10, 30)), event('b', at(10), at(11))])
    expect(map.get('a')).toEqual({ id: 'a', lane: 0, laneCount: 2 })
    expect(map.get('b')).toEqual({ id: 'b', lane: 1, laneCount: 2 })
    expect(map.get('missing')).toBeUndefined()
  })
})

describe('laneFraction', () => {
  it('gives a lone event the whole column', () => {
    expect(laneFraction({ id: 'a', lane: 0, laneCount: 1 })).toEqual({ left: 0, width: 1 })
  })

  it('offsets each lane by its own width', () => {
    expect(laneFraction({ id: 'a', lane: 0, laneCount: 2 })).toEqual({ left: 0, width: 0.5 })
    expect(laneFraction({ id: 'b', lane: 1, laneCount: 2 })).toEqual({ left: 0.5, width: 0.5 })
  })

  it('defends against a laneCount of zero rather than dividing by it', () => {
    expect(laneFraction({ id: 'a', lane: 0, laneCount: 0 })).toEqual({ left: 0, width: 1 })
  })
})
