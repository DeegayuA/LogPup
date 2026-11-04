/**
 * PRD Module B "Backlog Refinement": the Definition of Ready.
 *
 * Five of the six boxes are read off the work item itself, so they can never
 * disagree with it: a description, at least one acceptance criterion, an
 * estimate, an attachment (the design), at least one dependency link. The
 * sixth — product approval — is the one judgement nothing else records, so it
 * is an explicit stamp (tasks.product_approved_at).
 *
 * "Ready" itself is also a person's call (tasks.ready_at), not derived: a team
 * may knowingly mark a spike ready without a design. The checklist informs the
 * call and the card shows both, so a ready item with gaps is visible as such.
 */

export type ReadinessFacts = {
  description: string | null
  criteriaCount: number
  storyPoints: number | null
  attachmentCount: number
  linkCount: number
  productApproved: boolean
}

export const DOR_ITEMS = [
  { key: 'description', label: 'Description written' },
  { key: 'criteria', label: 'Acceptance criteria defined' },
  { key: 'estimate', label: 'Story estimated' },
  { key: 'design', label: 'Design attached' },
  { key: 'dependencies', label: 'Dependencies identified' },
  { key: 'approval', label: 'Product approval' },
] as const

export type DorKey = (typeof DOR_ITEMS)[number]['key']

export type DorCheck = { key: DorKey; label: string; met: boolean }

export function definitionOfReady(f: ReadinessFacts): DorCheck[] {
  const met: Record<DorKey, boolean> = {
    description: (f.description ?? '').trim().length > 0,
    criteria: f.criteriaCount > 0,
    estimate: f.storyPoints !== null,
    design: f.attachmentCount > 0,
    dependencies: f.linkCount > 0,
    approval: f.productApproved,
  }
  return DOR_ITEMS.map((item) => ({ ...item, met: met[item.key] }))
}

/** "4 of 6" — how much of the Definition of Ready is met. */
export function readinessScore(checks: readonly DorCheck[]): { met: number; total: number } {
  return { met: checks.filter((c) => c.met).length, total: checks.length }
}

export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]
export const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' }
