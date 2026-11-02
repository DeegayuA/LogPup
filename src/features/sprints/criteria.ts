/**
 * Pure logic behind a task's acceptance criteria — the "done means…"
 * checklist QA marks pass/fail (PRD Module A).
 *
 * Kept free of 'use server' and of the DB so the server action and the
 * client component share ONE definition of a valid criterion, of the order
 * rows appear in, and of what a move writes. The client uses `planMove` for
 * its optimistic reorder and the server uses it for the real write; if they
 * disagreed, the list would visibly jump when the server answer landed.
 */
import { z } from 'zod'
import { compareRanked, planInsert, type InsertPlan } from '@/features/sprints/task-rank'

/** Long enough for "Reset link expires after the configured time (default
 *  24h) and shows a clear message when used late"; short enough that a
 *  criterion stays a checkable statement rather than a second description. */
export const MAX_CRITERION_LENGTH = 500

/** A task with more than this is a spec, not a checklist — and the cap is what
 *  bounds the full-list read every move and append performs. */
export const MAX_CRITERIA_PER_TASK = 50

export const criterionBody = z
  .string()
  .trim()
  .min(1, 'Write the criterion first')
  .max(MAX_CRITERION_LENGTH, `Keep a criterion under ${MAX_CRITERION_LENGTH} characters`)

export const QA_VERDICTS = ['pass', 'fail'] as const
export type QaVerdict = (typeof QA_VERDICTS)[number]

export type CriterionRow = {
  id: string
  taskId: string
  body: string
  sortOrder: number
  qaVerdict: QaVerdict | null
  verifiedBy: string | null
  verifiedByName: string | null
  verifiedAt: Date | null
  createdAt: Date
}

export type CriteriaSummary = {
  total: number
  passed: number
  failed: number
  untested: number
  /** False for an empty list: "nothing to check" is not the same as "checked". */
  allPassed: boolean
}

export function summarizeCriteria(rows: ReadonlyArray<{ qaVerdict: string | null }>): CriteriaSummary {
  let passed = 0
  let failed = 0
  for (const row of rows) {
    if (row.qaVerdict === 'pass') passed++
    else if (row.qaVerdict === 'fail') failed++
  }
  const total = rows.length
  return { total, passed, failed, untested: total - passed - failed, allPassed: total > 0 && passed === total }
}

/** "3 of 5 passed · 1 failed". The failed clause only appears when non-zero —
 *  a "· 0 failed" on every header is noise that trains people to skip it. */
export function formatCriteriaSummary(summary: CriteriaSummary): string {
  if (summary.total === 0) return 'None yet'
  const base = `${summary.passed} of ${summary.total} passed`
  return summary.failed > 0 ? `${base} · ${summary.failed} failed` : base
}

/** Canonical order — rank, then creation time, then id; see task-rank.ts on
 *  why ties must be broken deterministically. Returns a new array. */
export function sortCriteria<T extends { sortOrder: number; createdAt: Date; id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort(compareRanked)
}

/**
 * What moving one criterion a step up or down writes, or null when it is
 * already at that end (or not in the list). `rows` may be in any order.
 *
 * Built on planInsert rather than swapping two ranks: a swap is two writes,
 * and two rows that tie (the DB default of 0, e.g. a row written by some
 * other path) would swap into the same tie and never move at all.
 */
export function planMove<T extends { sortOrder: number; createdAt: Date; id: string }>(
  rows: readonly T[],
  id: string,
  direction: 'up' | 'down',
): InsertPlan | null {
  const ordered = sortCriteria(rows)
  const index = ordered.findIndex((row) => row.id === id)
  if (index === -1) return null
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= ordered.length) return null
  const without = ordered.filter((row) => row.id !== id)
  return planInsert(without, target, id)
}

/** Applies a plan to a list (the optimistic half of a move). Pure. */
export function applyMovePlan<T extends { id: string; sortOrder: number }>(rows: readonly T[], id: string, plan: InsertPlan): T[] {
  if (plan.kind === 'rank') return rows.map((row) => (row.id === id ? { ...row, sortOrder: plan.sortOrder } : row))
  const ranks = new Map(plan.writes.map((write) => [write.id, write.sortOrder]))
  return rows.map((row) => {
    const next = ranks.get(row.id)
    return next === undefined ? row : { ...row, sortOrder: next }
  })
}

/** The activity-log fragment for a verdict change: "marked criterion as passed". */
export function verdictDetail(verdict: QaVerdict | null, body: string): string {
  const quoted = body.length > 80 ? `${body.slice(0, 79)}…` : body
  if (verdict === 'pass') return `marked criterion as passed: “${quoted}”`
  if (verdict === 'fail') return `marked criterion as failed: “${quoted}”`
  return `cleared the verdict on criterion: “${quoted}”`
}
