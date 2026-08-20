import { isWorkingDay } from '@/lib/working-days'

/**
 * How loud a deadline has become — one ladder, serving tasks and meeting
 * follow-ups alike.
 *
 * In `src/lib/` rather than a feature, because the two callers live in
 * different features and a copy in each is how they start disagreeing about
 * what "due soon" means. Pure: no database, no clock of its own. `todayIso`
 * is passed in, so a test can stand anywhere in the year and a render is not
 * quietly timezone-dependent — the caller resolves "today" in the business
 * timezone once (see `resolveWorkDay`) and everything downstream compares
 * `YYYY-MM-DD` strings.
 *
 * Dates are compared as STRINGS and never parsed into a `Date`. This is the
 * rule `src/features/people/task-workload.ts` documents and it is not
 * stylistic: `new Date('2026-08-12')` is midnight UTC, which is still the 11th
 * west of Greenwich, so an overdue list built on parsed dates is wrong for
 * half the planet for several hours a day.
 */
export type EscalationStep = 'none' | 'due-soon' | 'due-today' | 'overdue' | 'breached'

/** Working days from today within which a deadline counts as approaching. */
export const DUE_SOON_WORKING_DAYS = 7

/**
 * Working days past a COMMITTED date before it stops being merely overdue.
 * Two, not one: a promise missed by a single working day is usually a
 * standup's worth of slippage, and a rung that fires on all of those is a rung
 * people learn to scroll past before the real breaches arrive.
 */
export const BREACH_WORKING_DAYS = 2

/**
 * Notification kind per rung — TOTAL over the step union, and partial in its
 * values on purpose.
 *
 * `due-today` is a RENDER-ONLY rung with no kind and it never sends. The step
 * exists because the card, the my-day tile and the promises list all need to
 * say "today" in words rather than in a colour — but a bell arriving on the
 * morning somebody is already looking at the item is the worst
 * signal-to-noise rung in the ladder.
 *
 * Written as a total map so that a rung added later fails the build until
 * somebody decides whether it notifies. The alternative — a lookup returning
 * undefined for an unmapped step — is a new rung that silently notifies
 * nobody, which is indistinguishable from working.
 */
export const STEP_NOTIFICATION_KIND: Record<EscalationStep, string | null> = {
  none: null,
  'due-soon': 'deadline.due_soon',
  'due-today': null,
  overdue: 'deadline.overdue',
  breached: 'deadline.breached',
}

/** Every rung that actually sends. Derived, so it cannot drift from the map. */
export const NOTIFYING_STEPS = (Object.keys(STEP_NOTIFICATION_KIND) as EscalationStep[]).filter(
  (step) => STEP_NOTIFICATION_KIND[step] !== null,
)

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  // Midday UTC, the same anchor working-days.ts uses: far enough from either
  // boundary that a ±05:30 offset cannot tip the date to its neighbour.
  const at = new Date(Date.UTC(y, m - 1, d, 12))
  at.setUTCDate(at.getUTCDate() + 1)
  return at.toISOString().slice(0, 10)
}

/**
 * Working days after `from` up to and including `to`.
 *
 * Walks rather than does arithmetic because holidays are a predicate, not a
 * pattern — a Poya day in the middle of the range cannot be divided out.
 *
 * Bounded by `limit`: every caller only ever asks "is this within N", so
 * counting past N is work whose answer nobody reads, and it keeps a date years
 * away to a fixed number of steps.
 */
function workingDaysBetween(
  from: string,
  to: string,
  limit: number,
  isHoliday?: (iso: string) => boolean,
): number {
  let count = 0
  let cursor = from
  while (cursor < to && count <= limit) {
    cursor = nextDay(cursor)
    if (isWorkingDay(cursor, isHoliday)) count += 1
  }
  return count
}

export type EscalationInput = {
  /** `YYYY-MM-DD`, or null for an undated item — which is never escalated. */
  dueDate: string | null
  dueKind: 'target' | 'committed'
  /** Anything finished is silent, whatever its date says. */
  status: string
  /** Today in the business timezone, `YYYY-MM-DD`. */
  todayIso: string
  /** Optional holiday predicate, composed by the caller from the gazette and
   *  the workspace's own closures — the same composition coverage uses. */
  isHoliday?: (iso: string) => boolean
}

const DONE_STATUSES = new Set(['done', 'archived', 'resolved', 'cancelled'])

/**
 * The rung this item is on.
 *
 * NOTE WHAT THIS FUNCTION DOES NOT TAKE: a suppression list. Suppression is
 * about who gets NUDGED, never about what the item IS. An item that is overdue
 * stays overdue while somebody is on leave, on a holiday, or not scheduled to
 * work — and stays on every manager-facing at-risk list, because the client
 * still does not have the thing. Callers apply suppression when choosing
 * recipients, and this function is deliberately unable to help them apply it
 * to the number.
 */
export function escalationStep(input: EscalationInput): EscalationStep {
  const { dueDate, dueKind, status, todayIso, isHoliday } = input
  if (!dueDate) return 'none'
  if (DONE_STATUSES.has(status)) return 'none'

  if (dueDate === todayIso) return 'due-today'

  if (dueDate > todayIso) {
    const away = workingDaysBetween(todayIso, dueDate, DUE_SOON_WORKING_DAYS, isHoliday)
    return away <= DUE_SOON_WORKING_DAYS ? 'due-soon' : 'none'
  }

  // Past its date. A target stops at overdue; only a promise can be breached,
  // because only a promise had a counterparty to break it with.
  if (dueKind !== 'committed') return 'overdue'
  const late = workingDaysBetween(dueDate, todayIso, BREACH_WORKING_DAYS, isHoliday)
  return late >= BREACH_WORKING_DAYS ? 'breached' : 'overdue'
}

/** Whether this rung should reach the person. Never consulted for display. */
export function notificationKindFor(step: EscalationStep): string | null {
  return STEP_NOTIFICATION_KIND[step]
}
