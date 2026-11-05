'use client'

/**
 * "Blocks / is blocked by / fixes…" for one task — the work_links edges,
 * grouped by how they read from this task's side.
 *
 * RENDERS INSIDE THE TASK DIALOG'S <form>, like acceptance-criteria.tsx: no
 * <form> here, every button is type="button", and Enter in the search box is
 * preventDefault-ed (it picks the top result instead of saving the task).
 *
 * SEARCH IS DEBOUNCED AND DEDUPED. Each keystroke restarts a 250ms timer;
 * a query already asked (or still in flight) reuses its promise rather than
 * asking again, and a sequence number drops any answer that arrives after a
 * newer query was sent — otherwise a slow "lo" could overwrite a fast "log-1".
 *
 * REMOVE IS OPTIMISTIC with a narrow rollback: only the removed row is put
 * back on failure, so two quick removals cannot undo each other.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Bug, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appTabHref, boardHref } from '@/features/apps/tabs'
import { TaskTypeIcon } from '@/features/sprints/components/task-type-icon'
import { LINK_CHOICES, groupLinksByLabel } from '@/features/sprints/links'
import {
  addTaskLink,
  listTaskLinks,
  removeTaskLink,
  searchLinkTargets,
  type LinkTarget,
  type LinkedItem,
  type TaskLink,
} from '@/features/sprints/links-actions'

type Load = { key: string; error: string | null }
type SearchState = { query: string; results: LinkTarget[]; error: string | null; pending: boolean }

const SEARCH_DEBOUNCE_MS = 250
const IDLE_SEARCH: SearchState = { query: '', results: [], error: null, pending: false }

function itemHref(item: LinkedItem, appSlug: string): string {
  return item.type === 'task' ? boardHref(appSlug, item.sprintId ?? 'backlog') : appTabHref(appSlug, 'bugs')
}

function statusText(status: string): string {
  return status.replace(/_/g, ' ')
}

function ItemIcon({ item }: { item: LinkedItem }) {
  if (item.type === 'task' && item.taskType) return <TaskTypeIcon type={item.taskType} />
  return <Bug className="size-3.5 shrink-0 text-destructive" aria-hidden />
}

function ItemSummary({ item }: { item: LinkedItem }) {
  return (
    <>
      <ItemIcon item={item} />
      <span className="sr-only">{item.type === 'bug' ? 'Bug' : 'Task'}</span>
      {item.key && <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.key}</span>}
      <span className="min-w-0 truncate">{item.title}</span>
      <span className="ml-auto shrink-0 rounded-4xl bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
        {statusText(item.status)}
      </span>
    </>
  )
}

export function TaskLinks({ taskId, appSlug, canEdit }: { taskId: string; appSlug: string; canEdit: boolean }) {
  const [links, setLinks] = useState<TaskLink[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [load, setLoad] = useState<Load | null>(null)
  const requestKey = `${taskId}:${reloadKey}`

  const [adding, setAdding] = useState(false)
  const [choice, setChoice] = useState<string>(LINK_CHOICES[0].value)
  const [search, setSearch] = useState<SearchState>(IDLE_SEARCH)
  const [saving, setSaving] = useState(false)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)
  // Per-task cache of query -> promise: dedupes a query still in flight AND
  // one already answered (backspacing to an earlier query is instant).
  const cache = useRef(new Map<string, ReturnType<typeof searchLinkTargets>>())

  // Loading is derived from "has the answer for this exact request arrived",
  // so a retry needs no synchronous setState inside the effect.
  useEffect(() => {
    let cancelled = false
    listTaskLinks(taskId).then(
      (result) => {
        if (cancelled) return
        if (result.ok) setLinks(result.data)
        setLoad({ key: requestKey, error: result.ok ? null : result.error })
      },
      () => {
        if (!cancelled) setLoad({ key: requestKey, error: 'Could not load links' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [taskId, requestKey])

  useEffect(() => {
    const searches = cache.current
    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
      searches.clear()
    }
  }, [taskId])

  const status = load?.key !== requestKey ? 'loading' : load.error ? 'error' : 'ready'

  function runSearch(query: string) {
    const mine = ++seq.current
    let request = cache.current.get(query)
    if (!request) {
      request = searchLinkTargets(taskId, query)
      cache.current.set(query, request)
      // A failure must not be cached: the next keystroke should try again.
      request.then(
        (r) => { if (!r.ok) cache.current.delete(query) },
        () => cache.current.delete(query),
      )
    }
    request.then(
      (result) => {
        if (mine !== seq.current) return
        setSearch({
          query,
          results: result.ok ? result.data : [],
          error: result.ok ? null : result.error,
          pending: false,
        })
      },
      () => {
        if (mine !== seq.current) return
        setSearch({ query, results: [], error: 'Search failed', pending: false })
      },
    )
  }

  function onQueryChange(value: string) {
    if (timer.current !== null) clearTimeout(timer.current)
    const query = value.trim()
    if (query === '') {
      seq.current += 1 // any answer still coming is for a query nobody is looking at
      setSearch({ ...IDLE_SEARCH, query: value })
      return
    }
    setSearch((s) => ({ ...s, query: value, pending: true }))
    timer.current = setTimeout(() => {
      timer.current = null
      runSearch(query)
    }, SEARCH_DEBOUNCE_MS)
  }

  function closeAdder() {
    if (timer.current !== null) clearTimeout(timer.current)
    seq.current += 1
    setAdding(false)
    setSearch(IDLE_SEARCH)
  }

  async function pick(target: LinkTarget) {
    const selected = LINK_CHOICES.find((c) => c.value === choice) ?? LINK_CHOICES[0]
    setSaving(true)
    try {
      const result = await addTaskLink(taskId, {
        kind: selected.kind,
        direction: selected.direction,
        toType: target.type,
        toId: target.id,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      // Optimistic insert of what the server just accepted, then a silent
      // refresh so the row carries its real id and canonical ordering.
      setLinks((current) => [
        { linkId: result.data.linkId, label: selected.label, other: target },
        ...current,
      ])
      closeAdder()
      const fresh = await listTaskLinks(taskId)
      if (fresh.ok) setLinks(fresh.data)
    } catch {
      toast.error('Could not save the link')
    } finally {
      setSaving(false)
    }
  }

  async function remove(link: TaskLink) {
    setLinks((current) => current.filter((l) => l.linkId !== link.linkId))
    const restore = () =>
      setLinks((current) => (current.some((l) => l.linkId === link.linkId) ? current : [...current, link]))
    try {
      const result = await removeTaskLink(link.linkId)
      if (!result.ok) {
        restore()
        toast.error(result.error)
      }
    } catch {
      restore()
      toast.error('Could not remove the link')
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Escape closes this search, not the whole task dialog behind it.
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeAdder()
      return
    }
    if (event.key !== 'Enter') return
    // Never let Enter reach the task dialog's form.
    event.preventDefault()
    const top = search.results[0]
    if (top && !saving && !search.pending) void pick(top)
  }

  const groups = groupLinksByLabel(links)
  const linkedIds = new Set(links.map((l) => `${l.other.type}:${l.other.id}`))

  return (
    <section aria-labelledby={`task-links-${taskId}`} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`task-links-${taskId}`} className="text-sm font-medium">Links</h3>
        {canEdit && status === 'ready' && !adding && (
          <Button type="button" variant="ghost" size="xs" onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Add link
          </Button>
        )}
      </div>

      {status === 'loading' && (
        <div className="flex flex-col gap-1.5" aria-busy="true" aria-label="Loading links">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-3/4" />
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{load?.error ?? 'Could not load links'}</span>
          <Button type="button" variant="outline" size="xs" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {status === 'ready' && groups.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Not linked to anything</p>
      )}

      {status === 'ready' && groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">{group.label}</p>
          <ul className="flex flex-col gap-1">
            {group.items.map((link) => (
              <li key={link.linkId} className="flex items-center gap-1">
                <Link
                  href={itemHref(link.other, appSlug)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ItemSummary item={link.other} />
                </Link>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove link: ${group.label} ${link.other.key ?? link.other.title}`}
                    onClick={() => void remove(link)}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {canEdit && adding && (
        <div className="flex flex-col gap-2 rounded-lg border p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={choice} onValueChange={(value) => setChoice(value ?? LINK_CHOICES[0].value)}>
              <SelectTrigger size="sm" aria-label="Link type">
                <SelectValue>
                  {(value: string) => LINK_CHOICES.find((c) => c.value === value)?.label ?? 'blocks'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LINK_CHOICES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              autoFocus
              value={search.query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search by title or key (LOG-12)"
              aria-label="Find a task or bug to link"
              maxLength={100}
              disabled={saving}
              className="h-7 min-w-40 flex-1"
            />
            <Button type="button" variant="ghost" size="xs" onClick={closeAdder}>
              Cancel
            </Button>
          </div>

          <div aria-live="polite" className="text-xs text-muted-foreground">
            {search.pending && 'Searching…'}
            {!search.pending && search.error}
            {!search.pending && !search.error && search.query.trim() !== '' && search.results.length === 0
              && 'Nothing in this project matches'}
          </div>

          {search.results.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {search.results.map((target) => {
                const already = linkedIds.has(`${target.type}:${target.id}`)
                return (
                  <li key={`${target.type}:${target.id}`}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void pick(target)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                    >
                      <ItemSummary item={target} />
                      {already && <span className="sr-only">(already linked)</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
