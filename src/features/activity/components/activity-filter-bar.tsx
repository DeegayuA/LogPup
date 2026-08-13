'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { activityParams } from '@/features/activity/filters'
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

/**
 * Free-text search, debounced rather than committed on blur — search reads
 * as "live" in a way a date field doesn't, so navigating after every
 * keystroke would be too slow but waiting for blur would feel broken.
 *
 * Same local-draft-plus-remount pattern as DateFilter above: the parent keys
 * this by the committed value so a navigation that changes `q` out from
 * under it (Clear, back button, a shared link) resets the draft instead of
 * fighting a stale local state.
 */
function SearchFilter({
  value,
  onCommit,
}: {
  value: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function commit(next: string) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (next !== value) onCommit(next)
  }

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="text"
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          if (timer.current) clearTimeout(timer.current)
          // 400ms: long enough that a normal typing burst doesn't fire a
          // navigation per keystroke, short enough that search still feels
          // live rather than laggy.
          timer.current = setTimeout(() => commit(next), 400)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(draft)
          }
          if (e.key === 'Escape') {
            if (timer.current) clearTimeout(timer.current)
            setDraft(value)
          }
        }}
        placeholder="Search the trail…"
        aria-label="Search activity"
        className="h-8 w-56 pl-7 text-xs"
      />
    </div>
  )
}

/** What the /activity URL currently says. '' means "not filtered". */
export type ActivityFilterState = {
  person: string
  type: string
  app: string
  from: string
  to: string
  q: string
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
    const qs = activityParams(next).toString()
    router.push(qs ? `/activity?${qs}` : '/activity')
  }

  const anyFilter =
    current.person !== '' ||
    current.type !== '' ||
    current.app !== '' ||
    current.from !== '' ||
    current.to !== '' ||
    current.q !== ''

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
      <SearchFilter key={`q-${current.q}`} value={current.q} onCommit={(q) => apply({ q })} />

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
          onClick={() => apply({ person: '', type: '', app: '', from: '', to: '', q: '' })}
        >
          <X aria-hidden /> Clear
        </Button>
      ) : null}
    </div>
  )
}
