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
    <Button type="submit" variant="destructive" size="lg" disabled={pending}>
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close form in response to server action result
      setOpen(false)
    } else {
      toast.error(state.error)
    }
  }, [state])

  if (!open) {
    return (
      <Button variant="destructive" className="self-start" onClick={() => setOpen(true)}>
        Clear database…
      </Button>
    )
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="text-sm text-muted-foreground">
        Deletes all apps, assignments, sprints, tasks, meetings and work logs. Users are
        kept. This cannot be undone. Type{' '}
        <span className="font-mono text-xs font-medium text-foreground">CLEAR</span> to
        confirm.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="confirm"
          placeholder="CLEAR"
          autoComplete="off"
          aria-label="Type CLEAR to confirm"
          className="h-9 max-w-[160px] font-mono text-sm"
        />
        <ConfirmButton />
        <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
