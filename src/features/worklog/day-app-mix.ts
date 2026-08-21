// Which projects a logged day went to, as the few segments a 28px cell can
// actually carry.
//
// The progress matrix answers "did they log, and how much of what they
// planned". It could not answer "on what" — the question a lead asks
// immediately afterwards, and had to leave the page to answer.
//
// THE NUMBER STAYS THE SUBJECT. Colour goes in a thin bar under the percent,
// never behind it: a saturated cell background would fight the figure it is
// meant to annotate, and the eight identity hues were never chosen to carry
// text. The bar is proportional to MINUTES, so a day that was nine parts one
// project reads as that at a glance.
//
// Unattributed time gets a NEUTRAL segment, never a hue. Time nobody assigned
// to a project is a real and common state — admin, learning, an interview —
// and giving it a colour would invent a project for it, which is the same
// class of lie as every other made-up figure removed from this codebase.

/** One worklog entry, reduced to what the mix needs. */
export type DayEntry = {
  appId: string | null
  appName: string | null
  minutes: number
}

export type MixSegment = {
  /** Null for time attributed to no project — rendered neutral, never a hue. */
  appId: string | null
  /** "Unassigned" when appId is null, so every segment can be named. */
  label: string
  minutes: number
  /** 0–1 of the day's logged minutes. Segments always sum to 1. */
  share: number
}

/**
 * How many hues one cell may carry before it stops reading as a proportion and
 * starts reading as confetti. Three plus a merged remainder is the most a
 * 28-pixel bar can distinguish.
 */
export const MAX_MIX_SEGMENTS = 3

/** The merged tail. Named with a count, because "other" alone is not an answer. */
export const OTHER_LABEL = 'Other projects'

export function buildDayMix(entries: readonly DayEntry[]): MixSegment[] {
  const positive = entries.filter((e) => e.minutes > 0)
  const total = positive.reduce((sum, e) => sum + e.minutes, 0)
  if (total === 0) return []

  const byApp = new Map<string, { appId: string | null; label: string; minutes: number }>()
  for (const entry of positive) {
    const key = entry.appId ?? ''
    const existing = byApp.get(key)
    if (existing) {
      existing.minutes += entry.minutes
      continue
    }
    byApp.set(key, {
      appId: entry.appId,
      // A project whose name did not come back is still THAT project's time —
      // it keeps its hue and gets a placeholder label, rather than being folded
      // in with genuinely unassigned work.
      label: entry.appId === null ? 'Unassigned' : (entry.appName ?? 'Project'),
      minutes: entry.minutes,
    })
  }

  // Biggest first, then by label so equal minutes never reshuffle between
  // renders — the same total-order rule the rest of this codebase follows.
  const ordered = [...byApp.values()].sort(
    (a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label),
  )

  const head = ordered.slice(0, MAX_MIX_SEGMENTS)
  const tail = ordered.slice(MAX_MIX_SEGMENTS)
  const merged =
    tail.length > 0
      ? [
          {
            appId: null,
            label: `${OTHER_LABEL} (${tail.length})`,
            minutes: tail.reduce((sum, t) => sum + t.minutes, 0),
          },
        ]
      : []

  return [...head, ...merged].map((segment) => ({
    ...segment,
    share: segment.minutes / total,
  }))
}

export type LegendEntry = { appId: string; label: string; minutes: number }

/**
 * Every project on screen, for the legend — built from the SAME entries the
 * cells are, so a hue in the grid always has a name under it, and a name in
 * the legend is always somewhere in the grid.
 *
 * Unassigned time is deliberately absent: it has no hue to explain, and a
 * legend row for "no colour" teaches nothing.
 */
export function buildMixLegend(entries: readonly DayEntry[]): LegendEntry[] {
  const byApp = new Map<string, LegendEntry>()
  for (const entry of entries) {
    if (entry.appId === null || entry.minutes <= 0) continue
    const existing = byApp.get(entry.appId)
    if (existing) {
      existing.minutes += entry.minutes
      continue
    }
    byApp.set(entry.appId, {
      appId: entry.appId,
      label: entry.appName ?? 'Project',
      minutes: entry.minutes,
    })
  }
  return [...byApp.values()].sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label))
}
