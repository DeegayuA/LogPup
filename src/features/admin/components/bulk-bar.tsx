'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  bulkResultTone,
  describeBulkResult,
  groupSkipReasons,
  type BulkNouns,
  type BulkReport,
} from '@/features/admin/bulk-logic'

/**
 * The bar that appears once something is selected. Not sticky: the admin card
 * clips its own overflow, so a sticky child would be clipped rather than
 * pinned — and a bar that sits directly above the rows it acts on is next to
 * the checkboxes that filled it anyway.
 */
export function BulkBar({
  count,
  noun,
  onClear,
  children,
}: {
  count: number
  noun: BulkNouns
  onClear: () => void
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
    >
      <span className="text-sm font-medium tabular-nums">
        {count} {count === 1 ? noun.one : noun.many} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  )
}

/**
 * The one place a batch is allowed to announce itself.
 *
 * A batch that hit a guard on half its rows is the normal case — the
 * last-superadmin check, the self-target check and the open-work check all
 * refuse per row — so the toast is a success ONLY when nothing was refused,
 * and the reasons ride along in the description rather than being dropped.
 */
export function toastBulkResult(report: BulkReport, doneVerb: string, noun: BulkNouns) {
  const message = describeBulkResult(report, doneVerb, noun)
  const reasons = groupSkipReasons(report.skipped)
  const description = reasons.length
    ? reasons.map((group) => `${group.ids.length} × ${group.reason}`).join(' · ')
    : undefined

  const tone = bulkResultTone(report)
  if (tone === 'success') toast.success(message)
  else if (tone === 'warning') toast.warning(message, { description })
  else toast.error(message, { description })
}
