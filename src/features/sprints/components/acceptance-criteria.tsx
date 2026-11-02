'use client'

/**
 * Acceptance criteria inside the task dialog — the "done means…" list QA
 * marks pass/fail.
 *
 * RENDERS INSIDE THE TASK DIALOG'S <form>. Hence no <form> here (nested forms
 * are invalid HTML and the inner submit would post the outer one), every
 * button is type="button", and Enter in either input is preventDefault-ed —
 * otherwise typing a criterion and pressing Enter would save the whole task.
 *
 * OPTIMISTIC, WITH NARROW ROLLBACK. Each write applies locally first and, on
 * failure, restores only the fields it changed on the row it touched. Not a
 * whole-list snapshot: two quick clicks on different rows would otherwise
 * have the first failure roll back the second success.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Check, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  addCriterion,
  deleteCriterion,
  editCriterion,
  listCriteria,
  moveCriterion,
  setVerdict,
} from '@/features/sprints/criteria-actions'
import {
  MAX_CRITERIA_PER_TASK,
  MAX_CRITERION_LENGTH,
  applyMovePlan,
  formatCriteriaSummary,
  planMove,
  sortCriteria,
  summarizeCriteria,
  type CriterionRow,
  type QaVerdict,
} from '@/features/sprints/criteria'

type Load = { key: string; error: string | null }

export function AcceptanceCriteria({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<CriterionRow[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [load, setLoad] = useState<Load | null>(null)
  const [draft, setDraft] = useState('')
  const requestKey = `${taskId}:${reloadKey}`

  // Loading is DERIVED from "has the answer for this exact request arrived",
  // so neither a taskId change nor a retry needs a synchronous setState in
  // the effect to flip back to the skeleton.
  useEffect(() => {
    let cancelled = false
    listCriteria(taskId).then(
      (result) => {
        if (cancelled) return
        if (result.ok) setRows(result.data)
        setLoad({ key: requestKey, error: result.ok ? null : result.error })
      },
      () => {
        if (!cancelled) setLoad({ key: requestKey, error: 'Could not load the acceptance criteria' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [taskId, requestKey])

  const status = load?.key !== requestKey ? 'loading' : load.error ? 'error' : 'ready'
  const ordered = useMemo(() => sortCriteria(rows), [rows])
  const summary = summarizeCriteria(ordered)

  const patchRow = (id: string, patch: Partial<CriterionRow>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  async function add() {
    const body = draft.trim()
    if (!body) return
    if (rows.length >= MAX_CRITERIA_PER_TASK) {
      toast.error(`A task can have at most ${MAX_CRITERIA_PER_TASK} acceptance criteria`)
      return
    }
    const tempId = `temp-${crypto.randomUUID()}`
    const last = ordered.at(-1)
    const optimistic: CriterionRow = {
      id: tempId,
      taskId,
      body,
      sortOrder: (last?.sortOrder ?? 0) + 1024,
      qaVerdict: null,
      verifiedBy: null,
      verifiedByName: null,
      verifiedAt: null,
      createdAt: new Date(),
    }
    setRows((current) => [...current, optimistic])
    setDraft('')
    const result = await addCriterion(taskId, body).catch(() => null)
    if (result?.ok) {
      setRows((current) => current.map((row) => (row.id === tempId ? result.data : row)))
    } else {
      setRows((current) => current.filter((row) => row.id !== tempId))
      // Give the text back so a failed add does not cost the user their typing.
      setDraft((current) => current || body)
      toast.error(result?.error ?? 'Could not add the criterion')
    }
  }

  async function verdict(row: CriterionRow, next: QaVerdict | null) {
    const before = { qaVerdict: row.qaVerdict, verifiedBy: row.verifiedBy, verifiedByName: row.verifiedByName, verifiedAt: row.verifiedAt }
    patchRow(row.id, { qaVerdict: next, ...(next === null ? { verifiedBy: null, verifiedByName: null, verifiedAt: null } : {}) })
    const result = await setVerdict(row.id, next).catch(() => null)
    if (result?.ok) patchRow(row.id, result.data)
    else {
      patchRow(row.id, before)
      toast.error(result?.error ?? 'Could not record the verdict')
    }
  }

  async function edit(row: CriterionRow, body: string) {
    const trimmed = body.trim()
    if (!trimmed || trimmed === row.body) return
    const before = { body: row.body, qaVerdict: row.qaVerdict, verifiedBy: row.verifiedBy, verifiedByName: row.verifiedByName, verifiedAt: row.verifiedAt }
    patchRow(row.id, { body: trimmed, qaVerdict: null, verifiedBy: null, verifiedByName: null, verifiedAt: null })
    const result = await editCriterion(row.id, trimmed).catch(() => null)
    if (!result?.ok) {
      patchRow(row.id, before)
      toast.error(result?.error ?? 'Could not save the criterion')
    }
  }

  async function remove(row: CriterionRow) {
    setRows((current) => current.filter((r) => r.id !== row.id))
    const result = await deleteCriterion(row.id).catch(() => null)
    if (!result?.ok) {
      setRows((current) => (current.some((r) => r.id === row.id) ? current : [...current, row]))
      toast.error(result?.error ?? 'Could not delete the criterion')
    }
  }

  async function move(row: CriterionRow, direction: 'up' | 'down') {
    const plan = planMove(rows, row.id, direction)
    if (!plan) return
    const previousRanks = new Map(rows.map((r) => [r.id, r.sortOrder]))
    setRows((current) => applyMovePlan(current, row.id, plan))
    const result = await moveCriterion(row.id, direction).catch(() => null)
    if (result?.ok) {
      // Reconcile with what the server actually stored (it planned from its
      // own copy of the list, which may differ from ours).
      const ranks = new Map(result.data.map((r) => [r.id, r.sortOrder]))
      setRows((current) => current.map((r) => (ranks.has(r.id) ? { ...r, sortOrder: ranks.get(r.id)! } : r)))
    } else {
      setRows((current) => current.map((r) => (previousRanks.has(r.id) ? { ...r, sortOrder: previousRanks.get(r.id)! } : r)))
      toast.error(result?.error ?? 'Could not move the criterion')
    }
  }

  function onAddKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Escape with text typed clears the box rather than closing the task
    // dialog and losing what was written.
    if (event.key === 'Escape' && draft !== '') {
      event.preventDefault()
      event.stopPropagation()
      setDraft('')
      return
    }
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    // Without this the outer task form submits.
    event.preventDefault()
    void add()
  }

  return (
    <section aria-labelledby={`criteria-${taskId}`} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`criteria-${taskId}`} className="text-sm font-medium">
          Acceptance criteria
        </h3>
        {status === 'ready' && summary.total > 0 && (
          <span
            className={cn('text-xs text-muted-foreground', summary.allPassed && 'text-emerald-700 dark:text-emerald-400')}
            aria-live="polite"
          >
            {formatCriteriaSummary(summary)}
          </span>
        )}
      </div>

      {status === 'loading' && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading acceptance criteria">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm">
          <span className="text-destructive">{load?.error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No acceptance criteria yet — list what must be true for this to be done.
            </p>
          ) : (
            <ol className="space-y-1">
              {ordered.map((row, index) => (
                <CriterionItem
                  key={row.id}
                  row={row}
                  canEdit={canEdit}
                  isFirst={index === 0}
                  isLast={index === ordered.length - 1}
                  onVerdict={(next) => void verdict(row, next)}
                  onEdit={(body) => void edit(row, body)}
                  onDelete={() => void remove(row)}
                  onMove={(direction) => void move(row, direction)}
                />
              ))}
            </ol>
          )}

          {canEdit && (
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onAddKeyDown}
              maxLength={MAX_CRITERION_LENGTH}
              placeholder="+ Add a criterion — type and press Enter"
              aria-label="Add an acceptance criterion"
              className="h-8 text-sm"
            />
          )}
        </>
      )}
    </section>
  )
}

function CriterionItem({
  row,
  canEdit,
  isFirst,
  isLast,
  onVerdict,
  onEdit,
  onDelete,
  onMove,
}: {
  row: CriterionRow
  canEdit: boolean
  isFirst: boolean
  isLast: boolean
  onVerdict: (next: QaVerdict | null) => void
  onEdit: (body: string) => void
  onDelete: () => void
  onMove: (direction: 'up' | 'down') => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(row.body)
  const [confirming, setConfirming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // A temp row has no server id yet; acting on it would 404.
  const pending = row.id.startsWith('temp-')

  function startEdit() {
    setText(row.body)
    setEditing(true)
    // Focus after the input mounts.
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function commit() {
    setEditing(false)
    onEdit(text)
  }

  function onEditKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      // Escape cancels this edit only — it must not also close the dialog.
      event.preventDefault()
      event.stopPropagation()
      setEditing(false)
    }
  }

  const verdictButton = (value: QaVerdict, label: string) => {
    const pressed = row.qaVerdict === value
    return (
      <Button
        type="button"
        size="xs"
        variant={pressed ? (value === 'pass' ? 'default' : 'destructive') : 'outline'}
        aria-pressed={pressed}
        disabled={!canEdit || pending}
        onClick={() => onVerdict(pressed ? null : value)}
        className={cn(pressed && value === 'pass' && 'bg-emerald-600 text-white hover:bg-emerald-600/85')}
      >
        {value === 'pass' ? <Check aria-hidden /> : <X aria-hidden />}
        {label}
      </Button>
    )
  }

  return (
    <li className={cn('group rounded-md border px-2 py-1.5', pending && 'opacity-60')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onEditKeyDown}
              onBlur={commit}
              maxLength={MAX_CRITERION_LENGTH}
              aria-label="Edit acceptance criterion"
              className="h-7 text-sm"
            />
          ) : (
            <p className="text-sm break-words">{row.body}</p>
          )}
          {row.qaVerdict && row.verifiedByName && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.qaVerdict === 'pass' ? 'Passed' : 'Failed'} · verified by {row.verifiedByName}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {verdictButton('pass', 'Pass')}
          {verdictButton('fail', 'Fail')}
        </div>
      </div>

      {canEdit && !pending && (
        <div className="mt-1 flex items-center gap-1">
          {confirming ? (
            <>
              <span className="text-xs text-muted-foreground">Delete this criterion?</span>
              <Button type="button" size="xs" variant="destructive" onClick={() => { setConfirming(false); onDelete() }}>
                Delete
              </Button>
              <Button type="button" size="xs" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Move criterion up" disabled={isFirst} onClick={() => onMove('up')}>
                <ArrowUp aria-hidden />
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Move criterion down" disabled={isLast} onClick={() => onMove('down')}>
                <ArrowDown aria-hidden />
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Edit criterion" onClick={startEdit} disabled={editing}>
                <Pencil aria-hidden />
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Delete criterion" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  )
}
