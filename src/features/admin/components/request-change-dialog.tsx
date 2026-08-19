'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createChangeRequest } from '@/features/admin/change-request-actions'

/**
 * The path an editor takes when the matrix refuses them directly.
 *
 * Every delete, and every edit outside their scope or window, comes here
 * instead of failing with "not allowed" and nothing else. A refusal with no
 * route forward is how people learn to work around a system rather than
 * through it.
 */
export function RequestChangeDialog({
  entityType,
  entityId,
  entityLabel,
  operation,
  appId = null,
  before,
  after,
  trigger,
}: {
  entityType: string
  entityId: string
  entityLabel: string
  operation: 'edit' | 'delete' | 'restore'
  appId?: string | null
  /** Pre-image, so a stale approval can be caught rather than clobbering. */
  before: Record<string, unknown>
  after: Record<string, unknown>
  trigger?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (!reason.trim()) {
      toast.error('Say why — the reviewer sees this and nothing else.')
      return
    }
    startTransition(async () => {
      const res = await createChangeRequest({
        entityType,
        entityId,
        entityLabel,
        operation,
        appId,
        reason: reason.trim(),
        payload: { before, after },
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Request filed — it is waiting on a reviewer')
      setOpen(false)
      setReason('')
    })
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {trigger ?? `Request ${operation}`}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-sm">
        Requesting to {operation} <span className="font-medium">{entityLabel}</span>. Nothing
        changes until somebody approves it.
      </p>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why this change"
        aria-label="Reason for the change request"
        maxLength={500}
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={isPending}>
          {isPending ? 'Filing…' : 'File request'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
