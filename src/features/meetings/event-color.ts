/**
 * Which of the eight calendar hues an app gets (see --event-1..8 in
 * globals.css).
 *
 * DETERMINISTIC FROM THE APP ID, not from position in a list. The obvious
 * implementation — colour by index in whatever apps came back — repaints the
 * whole calendar the moment an app is added, renamed or archived, because
 * every index after it shifts. Hashing the id instead makes an app's colour a
 * property of the app: the same on the week grid, the month view, this week
 * and next, for every viewer, with no lookup table to keep in sync and
 * nothing to store.
 *
 * The cost is that two apps can collide on a hue. With eight slots that is
 * not rare, and it is accepted deliberately: colour here is a grouping aid on
 * top of a label that is always present (the app name is rendered on the
 * block), never the only way to tell two meetings apart. The alternative —
 * handing out unique colours from a registry — buys uniqueness up to eight
 * apps and then needs this same fallback anyway, at the price of a stored
 * column and a migration.
 *
 * A meeting with NO app gets no hue at all rather than a default one: a
 * colour meaning "no product" would read as just another product.
 */

export const EVENT_COLOR_COUNT = 8

/**
 * FNV-1a, 32-bit. Chosen over `id.charCodeAt(0) % 8` — uuids are hex, so
 * first characters span only 0-9a-f and cluster badly — and over anything
 * cryptographic, which is pointless here and slower on a render path. Pure
 * and synchronous so the server render and any client re-render agree.
 */
function hash(value: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    // The FNV prime multiply, written as shifts to stay in 32-bit integer
    // range — `h * 16777619` overflows into float territory and starts
    // losing low bits, which is exactly where the entropy is.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h >>> 0
}

/** 1-8 for an app, or null when the meeting isn't tied to one. */
export function eventColorSlot(appId: string | null | undefined): number | null {
  if (!appId) return null
  return (hash(appId) % EVENT_COLOR_COUNT) + 1
}

/**
 * The full class string for a coloured event block.
 *
 * Written out per slot rather than interpolated (`bg-event-${n}/12`) because
 * Tailwind scans source text: a class it never sees written down is a class
 * it never generates, so the block would render unstyled in production while
 * looking fine in dev.
 *
 * Border at full strength, fill at 12%: the border is what has to clear WCAG
 * 1.4.11 against the column behind it, and a fill strong enough to do that
 * job alone would fight the title sitting on top of it.
 */
const EVENT_CLASSES: Record<number, string> = {
  1: 'border-l-event-1 bg-event-1/12 text-foreground',
  2: 'border-l-event-2 bg-event-2/12 text-foreground',
  3: 'border-l-event-3 bg-event-3/12 text-foreground',
  4: 'border-l-event-4 bg-event-4/12 text-foreground',
  5: 'border-l-event-5 bg-event-5/12 text-foreground',
  6: 'border-l-event-6 bg-event-6/12 text-foreground',
  7: 'border-l-event-7 bg-event-7/12 text-foreground',
  8: 'border-l-event-8 bg-event-8/12 text-foreground',
}

/** Just the hue, for a dot or a legend swatch. */
const EVENT_DOT_CLASSES: Record<number, string> = {
  1: 'bg-event-1',
  2: 'bg-event-2',
  3: 'bg-event-3',
  4: 'bg-event-4',
  5: 'bg-event-5',
  6: 'bg-event-6',
  7: 'bg-event-7',
  8: 'bg-event-8',
}

/**
 * Block styling for a meeting's app. Returns null for an app-less meeting so
 * callers fall back to the neutral tone instead of getting an arbitrary hue.
 */
export function eventColorClasses(appId: string | null | undefined): string | null {
  const slot = eventColorSlot(appId)
  return slot === null ? null : EVENT_CLASSES[slot]
}

export function eventDotClasses(appId: string | null | undefined): string | null {
  const slot = eventColorSlot(appId)
  return slot === null ? null : EVENT_DOT_CLASSES[slot]
}
