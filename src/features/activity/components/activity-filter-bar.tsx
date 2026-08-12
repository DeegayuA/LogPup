'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ACTIVITY_ENTITY_TYPES } from '@/features/activity/types'

/** What the /activity URL currently says. '' means "not filtered". */
export type ActivityFilterState = {
  person: string
  type: string
  app: string
  from: string
  to: string
}

/**
 * The /activity filter row. State lives in the URL, nowhere else: every
 * change router.pushes a fresh query string and the server re-renders the
 * list. That makes a filtered view shareable/bookmarkable for free, and
 * navigation (back button) undoes filters the way people expect.
 *
 * The `before` pagination cursor is deliberately DROPPED on every change —
 * page two of the old filter is not a page of the new one.
 */
export function ActivityFilterBar({
  people,
  apps,
  current,
}: {
  people: { id: string; name: string }[]
  apps: { id: string; name: string }[]
  current: ActivityFilterState
}) {
  const router = useRouter()

  function apply(patch: Partial<ActivityFilterState>) {
    const next = { ...current, ...patch }
    const params = new URLSearchParams()
    if (next.person) params.set('person', next.person)
    if (next.type) params.set('type', next.type)
    if (next.app) params.set('app', next.app)
    if (next.from) params.set('from', next.from)
    if (next.to) params.set('to', next.to)
    const qs = params.toString()
    router.push(qs ? `/activity?${qs}` : '/activity')
  }

  const anyFilter =
    current.person !== '' ||
    current.type !== '' ||
    current.app !== '' ||
    current.from !== '' ||
    current.to !== ''

  // Base UI's Select reserves '' for "no selection", so the all-rows option
  // carries this sentinel instead and apply() maps it back to ''.
  const ALL = '__all__'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={current.person || ALL}
        onValueChange={(value) => apply({ person: !value || value === ALL ? '' : value })}
      >
        <SelectTrigger size="sm" className="w-40" aria-label="Filter by person">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All people</SelectItem>
          {people.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.type || ALL}
        onValueChange={(value) => apply({ type: !value || value === ALL ? '' : value })}
      >
        <SelectTrigger size="sm" className="w-36" aria-label="Filter by type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {ACTIVITY_ENTITY_TYPES.map((type) => (
            <SelectItem key={type} value={type} className="capitalize">
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.app || ALL}
        onValueChange={(value) => apply({ app: !value || value === ALL ? '' : value })}
      >
        <SelectTrigger size="sm" className="w-40" aria-label="Filter by app">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All apps</SelectItem>
          {apps.map((app) => (
            <SelectItem key={app.id} value={app.id}>
              {app.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={current.from}
        onChange={(e) => apply({ from: e.target.value })}
        aria-label="From date"
        className="h-8 w-36 font-mono text-xs"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        value={current.to}
        onChange={(e) => apply({ to: e.target.value })}
        aria-label="To date"
        className="h-8 w-36 font-mono text-xs"
      />

      {anyFilter ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => apply({ person: '', type: '', app: '', from: '', to: '' })}
        >
          <X aria-hidden /> Clear
        </Button>
      ) : null}
    </div>
  )
}
