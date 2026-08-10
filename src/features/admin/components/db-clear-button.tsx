'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clearTestData } from '@/features/admin/actions'
import type { ActionResult } from '@/lib/action-result'

function ConfirmButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? 'Clearing…' : 'Clear database'}
    </Button>
  )
}

export function DbClearButton() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState<ActionResult | null, FormData>(clearTestData, null)

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success('Database cleared (users kept)')
      setOpen(false)
    } else {
      toast.error(state.error)
    }
  }, [state])

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Clear database…
      </Button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-destructive/40 p-3">
      <p className="text-sm text-muted-foreground">
        Deletes all apps, assignments, sprints, tasks and meetings. Users are kept. This cannot be undone.
        Type <span className="font-mono font-medium text-foreground">CLEAR</span> to confirm.
      </p>
      <div className="flex items-center gap-2">
        <Input name="confirm" placeholder="CLEAR" autoComplete="off" className="max-w-[140px]" />
        <ConfirmButton />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
