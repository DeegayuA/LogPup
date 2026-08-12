'use client'

import { useState } from 'react'
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

/**
 * One date bound, typed locally and committed on blur or Enter.
 *
 * NOT a directly-controlled input bound to the URL. That version pushed a
 * navigation on every `onChange` — and since a `type="date"` field fires
 * onChange on each keyboard segment (month, then day, then year), a partial
 * value like "2026-08-" round-tripped to the server, came back as "" and
 * wiped what the user was mid-way through typing. Typing a date by keyboard
 * was impossible; only the picker worked.
 *
 * The parent gives each instance a `key` derived from the committed value, so
 * a navigation (Clear, back button, a shared link) remounts this with the new
 * value as its initial draft — resyncing without a setState-in-effect.
 */
function DateFilter({
  value,
  label,
  onCommit,
}: {
  value: string
  label: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)

  return (
    <Input
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') setDraft(value)
      }}
      aria-label={label}
      className="h-8 w-36 font-mono text-xs"
    />
  )
}

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

  // `items` is required on the person/app selects: Base UI's <Select.Value>
  // renders the raw value (a UUID here) unless the Root gets a value → label map.
  const personItems = [
    { value: ALL, label: 'All people' },
    ...people.map((person) => ({ value: person.id, label: person.name })),
  ]
  const appItems = [
    { value: ALL, label: 'All apps' },
    ...apps.map((app) => ({ value: app.id, label: app.name })),
  ]
  // The type select needs `items` for the same reason, even though its values
  // are already words: without the map, <Select.Value> shows the ALL sentinel
  // ("__all__") verbatim in the unfiltered default state.
  const typeItems = [
    { value: ALL, label: 'All types' },
    ...ACTIVITY_ENTITY_TYPES.map((type) => ({ value: type, label: type })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={current.person || ALL}
        items={personItems}
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
        items={typeItems}
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
        items={appItems}
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

      <DateFilter
        key={`from-${current.from}`}
        value={current.from}
        label="From date"
        onCommit={(from) => apply({ from })}
      />
      <span className="text-xs text-muted-foreground">to</span>
      <DateFilter
        key={`to-${current.to}`}
        value={current.to}
        label="To date"
        onCommit={(to) => apply({ to })}
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
