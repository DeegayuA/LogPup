'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateSprintStatus } from '@/features/sprints/actions'

type Status = 'planned' | 'active' | 'done'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
]

export function SprintStatusSelect({ sprintId, status }: { sprintId: string; status: Status }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string | null) {
    if (!value || value === status) return
    startTransition(async () => {
      const res = await updateSprintStatus(sprintId, value as Status)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Sprint status updated')
      router.refresh()
    })
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-36" aria-label="Sprint status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
