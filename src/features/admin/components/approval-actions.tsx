'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  approveChangeRequest,
  rejectChangeRequest,
} from '@/features/admin/change-request-actions'
import { approveAbsence, rejectAbsence } from '@/features/worklog/absence-actions'

/**
 * The controls that make the Approvals inbox an inbox rather than a list.
 *
 * Rendered only for rows the server already decided this actor may review —
 * `mayReview` filters the query — so this is presentation. Both actions
 * re-check on the server regardless.
 */
export function ApprovalActions({
  id,
  kind,
  isSelf = false,
}: {
  id: string
  kind: 'request' | 'absence'
  /** A self-filed row: legitimate for a superadmin, worth showing plainly. */
  isSelf?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  function run(decision: 'approve' | 'reject') {
    startTransition(async () => {
      try {
        const args = { id, note: note.trim() || undefined }
        const res =
          kind === 'request'
            ? decision === 'approve'
              ? await approveChangeRequest(args)
              : await rejectChangeRequest(args)
            : decision === 'approve'
              ? await approveAbsence(args)
              : await rejectAbsence(args)

        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(decision === 'approve' ? 'Approved' : 'Rejected')
        setRejecting(false)
        setNote('')
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why (optional)"
          aria-label="Reason for rejecting"
          className="h-8 max-w-64 text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={() => run('reject')} disabled={isPending}>
            {isPending ? 'Rejecting…' : 'Confirm reject'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => run('approve')} disabled={isPending}>
        {isPending ? 'Approving…' : isSelf ? 'Approve your own' : 'Approve'}
      </Button>
      {/* Two-step: rejecting is the one that ends somebody's request, and a
          reason is what makes the trail readable later. */}
      <Button size="sm" variant="ghost" onClick={() => setRejecting(true)} disabled={isPending}>
        Reject
      </Button>
    </div>
  )
}
