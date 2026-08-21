import { escalationStep, type EscalationStep } from '@/lib/escalation'

/**
 * The promises list: every open COMMITTED deadline on one app.
 *
 * Pure — ordering, grading, and the sentence each row says. The database read
 * lives beside it; this module is what a test can check without a connection,
 * which is where every rule that matters lives.
 *
 * DELIBERATELY NARROW, and it stays a section rather than becoming a page. If
 * this list ever runs long, that is not a sign it needs pagination — it is a
 * sign `committed` has decayed into a seniority badge and stopped meaning
 * anything, which is itself the signal worth seeing.
 */

export type PromiseRow = {
  id: string
  title: string
  /** Who it was promised to, in words. The list's PRIMARY column. */
  dueCommitmentNote: string | null
  dueDate: string | null
  originalDueDate: string | null
  dueChangedCount: number
  status: string
  assigneeName: string | null
}

export type GradedPromise = PromiseRow & {
  step: EscalationStep
  /** "promised 12 Aug · moved 3 times", or null when there is nothing to say. */
  slipLine: string | null
}

/** Rung order for sorting: loudest first. */
const STEP_RANK: Record<EscalationStep, number> = {
  breached: 0,
  overdue: 1,
  'due-today': 2,
  'due-soon': 3,
  none: 4,
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** `2026-08-12` -> `12 Aug`. String surgery, never a Date: parsing an ISO day
 *  gives midnight UTC, which is the previous day west of Greenwich. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}

/**
 * What this promise has been through, or null when there is nothing worth
 * reporting.
 *
 * A row whose `originalDueDate` is null says NOTHING rather than claiming it
 * never moved. Those are the tasks that predate migration 0049 — dated before
 * the column existed, so they never received a stamp — and the honest render
 * for an unknown first promise is silence. See due-date.ts: no original means
 * no answer, not "no slip".
 */
export function slipLineFor(row: PromiseRow): string | null {
  if (!row.originalDueDate) return null
  const promised = `promised ${shortDate(row.originalDueDate)}`
  const moved = row.dueChangedCount
  if (moved === 0) return promised
  return `${promised} · moved ${moved} ${moved === 1 ? 'time' : 'times'}`
}

/**
 * Grade and order the app's promises.
 *
 * Rung first, date second, so the list reads as an agenda: what is already
 * broken, then what breaks next. Insertion or alphabetical order would bury a
 * breach under six comfortable rows.
 */
export function gradePromises(
  rows: readonly PromiseRow[],
  todayIso: string,
  isHoliday?: (iso: string) => boolean,
): GradedPromise[] {
  return rows
    .map((row) => ({
      ...row,
      step: escalationStep({
        dueDate: row.dueDate,
        // Every row here is committed by construction — the query filters on
        // it — so the grade is asked of the promise it actually is.
        dueKind: 'committed' as const,
        status: row.status,
        todayIso,
        isHoliday,
      }),
      slipLine: slipLineFor(row),
    }))
    .sort((a, b) => {
      const rank = STEP_RANK[a.step] - STEP_RANK[b.step]
      if (rank !== 0) return rank
      // Undated promises sort last within a rung: a commitment with no date is
      // the weakest kind there is, and should not head a list of dated ones.
      if (!a.dueDate) return b.dueDate ? 1 : 0
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
}

/**
 * One sentence for the section header. Counts what is WRONG rather than what
 * exists: "6 promises" tells a reader nothing they can act on, and a number
 * that only ever grows reads as inventory instead of as a warning.
 */
export function promisesSummary(graded: readonly GradedPromise[]): string {
  if (graded.length === 0) return 'No promises on this project yet.'
  const noun = graded.length === 1 ? 'promise' : 'promises'
  const breached = graded.filter((p) => p.step === 'breached').length
  const overdue = graded.filter((p) => p.step === 'overdue').length
  if (breached + overdue === 0) return `${graded.length} open ${noun}, none late.`

  const parts: string[] = []
  if (breached) parts.push(`${breached} breached`)
  if (overdue) parts.push(`${overdue} overdue`)
  return `${parts.join(', ')} of ${graded.length} open ${noun}.`
}
