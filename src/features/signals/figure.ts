/**
 * One number this system is willing to put on a screen, and everything a
 * reader needs to judge it.
 *
 * A productivity figure is the most dangerous kind of number a workspace can
 * render: it is about a person, it will be read by that person's manager, and
 * it arrives wearing the authority of arithmetic. So none of them travel bare.
 * Every figure carries where it came from, whether it was measured or inferred,
 * and — when there is no honest answer — the words for that instead of a zero.
 *
 * THE RULE, INHERITED FROM finance/cost.ts AND RESTATED BECAUSE IT MATTERS
 * MORE HERE: `null` means "cannot say"; `0` means "we can say, and it is
 * nothing". A cost of zero tells a reader the work was free. An unknown cost
 * tells them the rate card is incomplete. Applied to people, the same collapse
 * is worse: `0` commits for somebody who never linked a GitHub account reads
 * as "wrote no code this month" when the truth is "this app cannot see their
 * code". Every `| null` in this feature exists to stop that sentence being
 * said about somebody.
 */

export type FigureBasis =
  /** Counted from rows that record the thing itself. */
  | 'measured'
  /**
   * Derived from a proxy. Not a lesser number, but a different claim, and a
   * reader deciding what to do about somebody's week is entitled to know
   * which one they are looking at.
   */
  | 'inferred'

export type FigureUnit = 'count' | 'days' | 'hours' | 'percent' | 'perWorkingDay'

export type Figure = {
  key: string
  label: string
  /** The number, or null when there is no honest one. Never a stand-in zero. */
  value: number | null
  /**
   * Why there is no value, in the words a reader gets. Non-null exactly when
   * `value` is null — a figure that is blank AND silent about why is the
   * failure this whole type exists to prevent.
   */
  unavailable: string | null
  basis: FigureBasis
  unit: FigureUnit
  /** Which tables or modules produced this, named so a dispute can be settled. */
  sources: string[]
  /**
   * The key of the figure that gets WORSE if this one is gamed.
   *
   * Not decoration and not a "related metric" link. Every headline here can be
   * improved by behaviour nobody wants — close reviews without reading them,
   * resolve follow-ups without answering them, cut the meeting where the
   * design actually got argued. Naming the pair is what makes the scorecard
   * self-checking instead of a target list, and a headline without one is a
   * headline nobody has thought about hard enough.
   */
  counter?: string
}

export function measured(
  input: Omit<Figure, 'basis' | 'unavailable' | 'value'> & { value: number },
): Figure {
  return { ...input, value: input.value, unavailable: null, basis: 'measured' }
}

export function inferred(
  input: Omit<Figure, 'basis' | 'unavailable' | 'value'> & { value: number },
): Figure {
  return { ...input, value: input.value, unavailable: null, basis: 'inferred' }
}

/**
 * The honest empty figure: a slot with a reason in it.
 *
 * `reason` is written for the person being measured, not for a developer. "No
 * GitHub account linked" tells them what to do; "null" tells them they scored
 * zero.
 */
export function cannotSay(
  input: Omit<Figure, 'basis' | 'unavailable' | 'value'> & {
    reason: string
    basis?: FigureBasis
  },
): Figure {
  const { reason, basis, ...rest } = input
  return { ...rest, value: null, unavailable: reason, basis: basis ?? 'measured' }
}

/**
 * The smallest group a figure may be reported over.
 *
 * Two, for the reason `MIN_COST_CONTRIBUTORS` in finance/cost.ts is two: a
 * figure covering one person is that person, however it is labelled. "The
 * platform team's cycle time" over a team of one is an appraisal wearing a
 * project's name, and the label is what makes it feel shareable.
 *
 * This is not a privacy nicety bolted onto a reporting feature. In a studio
 * this size most projects have exactly one PM and one lead, so the suppression
 * path is the COMMON path, not the corner — which is why it is a shared
 * constant with a test rather than a check each rollup remembers.
 */
export const MIN_COHORT = 2

export type Suppressed = { suppressed: true; reason: string; cohortSize: number }

export function suppressIfSmall<T>(
  cohortSize: number,
  build: () => T,
): T | Suppressed {
  if (cohortSize < MIN_COHORT) {
    return {
      suppressed: true,
      cohortSize,
      reason:
        cohortSize === 1
          ? 'Only one person here — a group figure would just be theirs.'
          : 'Nobody here to report on.',
    }
  }
  return build()
}

export function isSuppressed<T>(value: T | Suppressed): value is Suppressed {
  return typeof value === 'object' && value !== null && 'suppressed' in value
}

/**
 * The median, or null for an empty list.
 *
 * Median rather than mean everywhere in this feature, deliberately. One
 * six-week task drags a mean cycle time past every number a reader could act
 * on, and the person it misrepresents is whoever happened to own the hard
 * thing. p90 is reported ALONGSIDE it where the tail is the point — never
 * instead of it.
 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * The p-th percentile by nearest-rank, or null for an empty list.
 *
 * Nearest-rank rather than interpolation because every input here is a count
 * of real days or real tasks: an interpolated "p90 cycle time of 11.4 days"
 * describes no task anybody worked on, while nearest-rank always names one
 * that actually took that long.
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]
}
