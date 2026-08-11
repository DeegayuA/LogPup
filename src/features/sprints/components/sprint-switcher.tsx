'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SwitcherSprint = { id: string; name: string; status: 'planned' | 'active' | 'done' }

export function SprintSwitcher({
  sprints,
  selectedId,
}: {
  sprints: SwitcherSprint[]
  selectedId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(sprintId: string | null) {
    if (!sprintId || sprintId === selectedId) return
    // Copy the existing params (e.g. ?tab=board) so switching sprints never
    // clobbers whatever else is in the URL.
    const params = new URLSearchParams(searchParams.toString())
    params.set('sprint', sprintId)
    router.push(`${pathname}?${params.toString()}`)
  }

  if (sprints.length === 0) return null

  return (
    <Select value={selectedId} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-56" aria-label="Select sprint">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sprints.map((sprint) => (
          <SelectItem key={sprint.id} value={sprint.id}>
            {sprint.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
