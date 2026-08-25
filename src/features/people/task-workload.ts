import { isoDayAdd, isoDayDiff } from '@/features/people/iso-day'
import { isTerminal } from '@/features/sprints/board-view'

/**
 * How a person's open tasks are ordered, grouped and counted.
 *
 * `tasks.dueDate` has been written since the ⌘K quick-add shipped ("finish the
 * migration friday") and by accepted meeting suggestions, but it was rendered
 * NOWHERE in the product — so "what is late" was a question the system held the
 * answer to and never answered. That is what this module exists for.
 *
 * DUE DATES ARE PLAIN CALENDAR DAYS. The column is `date`, not a timestamp, and
 * Postgres hands it back as a `YYYY-MM-DD` string. It is deliberately NOT
 * parsed into a Date here: `new Date('2026-08-12')` is midnight UTC, which is
 * still the 11th in every negative-offset zone, so the naive version of this
 * module would call a task overdue a day early for anyone west of Greenwich.
 * String comparison against a `todayIso` resolved in the business timezone
 * (see iso-day.ts) has no such failure mode.
 *
 * DONE TASKS ARE NOT MODELLED HERE. `tasks` has no completedAt/updatedAt
 * column, so "closed in the last 30 days" is not derivable from the schema at
 * all — only "created in the last 30 days and currently done", which is a
 * different and misleading statement. The page therefore reports done work as a
 * lifetime count and this module only ever sees open tasks. Adding
 * `tasks.completed_at` is the change that would unlock a real throughput
 * figure; nothing here needs to change when it lands beyond widening the row.
 */

export type PersonTaskStatus = 'todo' | 'in_progress' | 'done'

export type PersonTaskRow = {
  id: string
  title: string
  status: PersonTaskStatus
  /** 0 = none … 3 = high, matching the board's priority ramp. */
  priority: number
  /** `YYYY-MM-DD` from the `date` column, or null when nobody set one. */
  dueDate: string | null
  createdAt: Date
  appName: string
  appSlug: string
  sprintName: string | null
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none'

/** How far ahead still counts as "this week" rather than "later". */
export const DUE_SOON_DAYS = 7

export const DUE_STATE_LABEL: Record<DueState, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  soon: 'Due this week',
  later: 'Later',
  none: 'No due date',
}

/** Fixed rendering order: the debt first, the undated tail last. */
const DUE_STATE_ORDER: DueState[] = ['overdue', 'today', 'soon', 'later', 'none']

export function dueState(
  dueDate: string | null,
  todayIso: string,
  soonDays: number = DUE_SOON_DAYS,
): DueState {
  if (!dueDate) return 'none'
  if (dueDate < todayIso) return 'overdue'
  if (dueDate === todayIso) return 'today'
  return dueDate <= isoDayAdd(todayIso, soonDays) ? 'soon' : 'later'
}

/**
 * Ordering within a group: soonest deadline first, then highest priority, then
 * oldest — a task that has been sitting unstarted for three weeks outranks one
 * filed this morning at the same priority. Undated tasks sort after dated ones
 * so a group that mixes them (only ever 'none', but the comparator is total)
 * still reads deadline-first.
 */
export function compareOpenTasks(a: PersonTaskRow, b: PersonTaskRow): number {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  }
  if (a.priority !== b.priority) return b.priority - a.priority
  const byAge = a.createdAt.getTime() - b.createdAt.getTime()
  // Ids last so the order is stable for two tasks filed in the same batch.
  return byAge !== 0 ? byAge : a.id.localeCompare(b.id)
}

export type TaskBucket = {
  state: DueState
  label: string
  tasks: PersonTaskRow[]
}

/**
 * Open tasks grouped by how late they are. Empty groups are dropped rather
 * than rendered as headings with nothing under them, and a 'done' row is
 * filtered out defensively — the query only asks for open ones, but this
 * function is the thing that defines "open" for the UI and must not depend on
 * the caller remembering.
 */
export function bucketOpenTasks(rows: PersonTaskRow[], todayIso: string): TaskBucket[] {
  const open = rows.filter((row) => !isTerminal(row.status))
  return DUE_STATE_ORDER.map((state) => ({
    state,
    label: DUE_STATE_LABEL[state],
    tasks: open.filter((row) => dueState(row.dueDate, todayIso) === state).sort(compareOpenTasks),
  })).filter((bucket) => bucket.tasks.length > 0)
}

export type TaskLoad = {
  open: number
  overdue: number
  dueSoon: number
  /** Days past due on the LONGEST-overdue task, or null when nothing is late. */
  oldestOverdueDays: number | null
  /** How many distinct apps the open work is spread across. */
  apps: number
}

/**
 * The at-a-glance numbers for the tasks section. `dueSoon` counts today and the
 * next `DUE_SOON_DAYS` days but NOT overdue work — the two are separate
 * pressures and adding the late items into "this week" would let a person with
 * five overdue tasks and nothing scheduled read as busy-but-fine.
 */
export function summarizeOpenTasks(rows: PersonTaskRow[], todayIso: string): TaskLoad {
  const open = rows.filter((row) => !isTerminal(row.status))
  const states = open.map((row) => ({ row, state: dueState(row.dueDate, todayIso) }))
  const overdue = states.filter((entry) => entry.state === 'overdue')
  const oldest = overdue.reduce<number | null>((worst, entry) => {
    const days = isoDayDiff(todayIso, entry.row.dueDate!)
    return worst === null || days > worst ? days : worst
  }, null)

  return {
    open: open.length,
    overdue: overdue.length,
    dueSoon: states.filter((entry) => entry.state === 'today' || entry.state === 'soon').length,
    oldestOverdueDays: oldest,
    apps: new Set(open.map((row) => row.appSlug)).size,
  }
}
