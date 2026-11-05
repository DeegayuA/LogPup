import { toIsoDateInTimeZone, LK_TIMEZONE } from '@/lib/lk-holidays'
import type { TaskStatus } from '@/features/sprints/board-view'
import type { TaskType } from '@/features/sprints/hierarchy'

/**
 * PRD Module B "Sprint Metrics", as pure arithmetic over one sprint's tasks.
 *
 * POINTS, NOT TASKS, drive the burn charts — a sprint is planned in points
 * (Capacity 80 / Committed 72). An unestimated task counts 0 points and is
 * surfaced separately (`unestimatedCount`) rather than guessed at, because a
 * chart that silently ignores half the work reads as "on track".
 *
 * SCOPE IS TODAY'S SCOPE. Work added or removed mid-sprint is not tracked
 * historically (no scope-event table yet), so the burndown starts from the
 * sprint's current total. `committedPoints`, snapshotted when the sprint goes
 * active, is what the "planned" figures compare against once it exists.
 *
 * Days are Sri Lanka calendar days, same as every other date in the app.
 */

export type MetricTask = {
  points: number | null
  status: TaskStatus
  completedAt: Date | null
  type: TaskType
}

export type SprintWindow = {
  startDate: string
  endDate: string
  status: 'planned' | 'active' | 'done'
}

export type BurnPoint = {
  day: string
  /** Points still open at the end of this day; null for days not yet lived. */
  remaining: number | null
  /** Points done by the end of this day; null for days not yet lived. */
  completed: number | null
  /** The straight line from the full scope to zero. */
  ideal: number
}

export type SprintMetrics = {
  scopePoints: number
  completedPoints: number
  remainingPoints: number
  taskCount: number
  doneCount: number
  /** done / all tasks, 0..1; null for an empty sprint. */
  completionRate: number | null
  blockedCount: number
  blockedPoints: number
  bugCount: number
  unestimatedCount: number
  /** Moves to "QA failed" per move into QA, 0..1; null when nothing reached QA. */
  qaRejectionRate: number | null
  /** What a finished sprint left undone; null while it is still running. */
  carryOver: { count: number; points: number } | null
  burn: BurnPoint[]
}

/** Every calendar day from start to end, both included. */
export function sprintDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const end = new Date(`${endDate}T12:00:00Z`)
  for (let d = new Date(`${startDate}T12:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

const pts = (t: MetricTask) => t.points ?? 0
const round1 = (n: number) => Math.round(n * 10) / 10

export function computeSprintMetrics(input: {
  sprint: SprintWindow
  tasks: readonly MetricTask[]
  qa: { intoQa: number; intoQaFailed: number }
  today: string
  timeZone?: string
}): SprintMetrics {
  const { sprint, tasks, qa, today } = input
  const tz = input.timeZone ?? LK_TIMEZONE
  const done = tasks.filter((t) => t.status === 'done')
  const open = tasks.filter((t) => t.status !== 'done')
  const blocked = tasks.filter((t) => t.status === 'blocked')

  const scopePoints = round1(tasks.reduce((s, t) => s + pts(t), 0))
  const completedPoints = round1(done.reduce((s, t) => s + pts(t), 0))

  // A done task with no completion time (finished before completedAt existed)
  // or finished before the sprint began counts from day one.
  const doneOn = done.map((t) => {
    const day = t.completedAt ? toIsoDateInTimeZone(t.completedAt, tz) : sprint.startDate
    return { day: day < sprint.startDate ? sprint.startDate : day, points: pts(t) }
  })

  const days = sprintDays(sprint.startDate, sprint.endDate)
  const lastLived = sprint.status === 'done' ? sprint.endDate : today
  const burn = days.map((day, i) => {
    const ideal = round1(days.length > 1 ? scopePoints * (1 - i / (days.length - 1)) : 0)
    if (day > lastLived) return { day, remaining: null, completed: null, ideal }
    const completed = round1(doneOn.filter((d) => d.day <= day).reduce((s, d) => s + d.points, 0))
    return { day, remaining: round1(scopePoints - completed), completed, ideal }
  })

  return {
    scopePoints,
    completedPoints,
    remainingPoints: round1(scopePoints - completedPoints),
    taskCount: tasks.length,
    doneCount: done.length,
    completionRate: tasks.length > 0 ? done.length / tasks.length : null,
    blockedCount: blocked.length,
    blockedPoints: round1(blocked.reduce((s, t) => s + pts(t), 0)),
    bugCount: tasks.filter((t) => t.type === 'bug').length,
    unestimatedCount: tasks.filter((t) => t.points === null).length,
    qaRejectionRate: qa.intoQa > 0 ? Math.min(1, qa.intoQaFailed / qa.intoQa) : null,
    carryOver:
      sprint.status === 'done'
        ? { count: open.length, points: round1(open.reduce((s, t) => s + pts(t), 0)) }
        : null,
    burn,
  }
}

export type PlanLoad = {
  /** What the planning bar measures against capacity: the commitment once locked, else today's scope. */
  planned: number
  plannedIs: 'committed' | 'scope'
  /** planned / capacity, 0..∞; null with no capacity set. */
  load: number | null
  state: 'unset' | 'under' | 'full' | 'over'
}

/** "Capacity 80 · Committed 72": how full the sprint is planned. Full = 90–100%. */
export function planLoad(capacity: number | null, committed: number | null, scope: number): PlanLoad {
  const planned = committed ?? scope
  const plannedIs = committed === null ? 'scope' : 'committed'
  if (capacity === null || capacity <= 0) return { planned, plannedIs, load: null, state: 'unset' }
  const load = planned / capacity
  return { planned, plannedIs, load, state: load > 1 ? 'over' : load >= 0.9 ? 'full' : 'under' }
}

export type VelocityEntry ={ sprintId: string; name: string; completedPoints: number }

/** Mean completed points over finished sprints; null with none to average. */
export function averageVelocity(entries: readonly VelocityEntry[]): number | null {
  if (entries.length === 0) return null
  return round1(entries.reduce((s, e) => s + e.completedPoints, 0) / entries.length)
}
