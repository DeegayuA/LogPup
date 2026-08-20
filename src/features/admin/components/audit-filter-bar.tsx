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
import {
  auditQueryString,
  AUDIT_PATH,
  clearedAuditState,
  hasAuditFilters,
  type AuditParamState,
} from '@/features/admin/audit-filters'
import type { AuditFacets } from '@/features/admin/audit-queries'

/**
 * One date bound, typed locally and committed on blur or Enter.
 *
 * NOT a directly-controlled input bound to the URL. A `type="date"` field
 * fires onChange on each keyboard segment (month, then day, then year), so a
 * partial value like "2026-08-" round-trips to the server, comes back as ""
 * and wipes what the user was mid-way through typing — typing a date by
 * keyboard becomes impossible and only the picker works.
 *
 * The parent keys each instance by the committed value, so a navigation
 * (Clear, back button, a shared link) remounts this with the new value as its
 * initial draft — resyncing without a setState-in-effect.
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
 * Free-text search, debounced rather than committed on blur — search reads as
 * "live" in a way a date field does not, so navigating per keystroke would be
 * too slow while waiting for blur would feel broken.
 *
 * Same local-draft-plus-remount pattern as DateFilter: the parent keys this by
 * the committed value, so a navigation that changes `q` out from under it
 * resets the draft instead of fighting a stale local state.
 */
function SearchFilter({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
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
        type="search"
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          if (timer.current) clearTimeout(timer.current)
          // 400ms: long enough that a normal typing burst does not fire a
          // navigation per keystroke, short enough that search still feels
          // live rather than laggy. Same figure as /activity's.
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
        placeholder="Search who, what, detail…"
        aria-label="Search the audit trail"
        className="h-8 w-56 pl-7 text-xs"
      />
    </div>
  )
}

// Base UI's Select reserves '' for "no selection", so the all-rows option
// carries this sentinel and apply() maps it back to ''.
const ALL = '__all__'

/**
 * The /admin/audit filter row.
 *
 * State lives in the URL, nowhere else: every change pushes a fresh query
 * string and the server re-renders. That makes a filtered audit view — which
 * is evidence someone pastes into a review — shareable and refresh-proof for
 * free, and the back button undoes filters the way people expect.
 *
 * `page` is dropped on every change (auditHref's rule) and `sort` is kept:
 * page four of the old filter is not a page of the new one, but the order the
 * reader chose is still the order they want.
 */
export function AuditFilterBar({
  facets,
  current,
}: {
  facets: AuditFacets
  current: AuditParamState
}) {
  const router = useRouter()

  function apply(patch: Partial<AuditParamState>) {
    const next: AuditParamState = { ...current, ...patch, page: 1 }
    const qs = auditQueryString(next)
    router.push(qs ? `${AUDIT_PATH}?${qs}` : AUDIT_PATH)
  }

  // `items` is required on every select: Base UI's <Select.Value> renders the
  // raw value (a UUID, or the ALL sentinel spelled "__all__") unless the Root
  // is given a value → label map.
  const actorItems = [
    { value: ALL, label: 'Anyone' },
    ...facets.actors.map((actor) => ({ value: actor.id, label: actor.name })),
  ]
  const typeItems = [
    { value: ALL, label: 'Any type' },
    ...facets.types.map((type) => ({ value: type, label: type })),
  ]
  const verbItems = [
    { value: ALL, label: 'Any action' },
    ...facets.verbs.map((verb) => ({ value: verb, label: verb })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchFilter key={`q-${current.q}`} value={current.q} onCommit={(q) => apply({ q })} />

      <Select
        value={current.actor || ALL}
        items={actorItems}
        onValueChange={(value) => apply({ actor: !value || value === ALL ? '' : String(value) })}
      >
        <SelectTrigger size="sm" className="w-40" aria-label="Filter by who made the change">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Anyone</SelectItem>
          {facets.actors.map((actor) => (
            <SelectItem key={actor.id} value={actor.id}>
              {actor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.type || ALL}
        items={typeItems}
        onValueChange={(value) => apply({ type: !value || value === ALL ? '' : String(value) })}
      >
        <SelectTrigger size="sm" className="w-36" aria-label="Filter by what was changed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any type</SelectItem>
          {facets.types.map((type) => (
            <SelectItem key={type} value={type} className="capitalize">
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.verb || ALL}
        items={verbItems}
        onValueChange={(value) => apply({ verb: !value || value === ALL ? '' : String(value) })}
      >
        <SelectTrigger size="sm" className="w-36" aria-label="Filter by action">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any action</SelectItem>
          {facets.verbs.map((verb) => (
            <SelectItem key={verb} value={verb} className="capitalize">
              {verb}
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

      {/* The one filter this surface has that /activity does not: the
          self-approval mark is why the audit read exists at all, and a
          reviewer looking for three of them should not have to page through
          four hundred rows. */}
      <Button
        variant={current.self ? 'secondary' : 'ghost'}
        size="sm"
        aria-pressed={current.self}
        onClick={() => apply({ self: !current.self })}
      >
        Self-approved only
      </Button>

      {hasAuditFilters(current) ? (
        <Button variant="ghost" size="sm" onClick={() => apply(clearedAuditState(current))}>
          <X aria-hidden /> Clear
        </Button>
      ) : null}
    </div>
  )
}
