'use client'

import * as React from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/lib/action-result'
import {
  createComponent,
  createLabel,
  listTaskTags,
  setTaskComponents,
  setTaskLabels,
  type TaskLabel,
  type TaskTag,
  type TaskTags,
} from '@/features/sprints/labels-actions'
import {
  MAX_TAGS_PER_TASK,
  hasTagNamed,
  labelChipClasses,
  labelDotClasses,
  normaliseTagName,
  toggleId,
} from '@/features/sprints/labels'

/**
 * Labels and components on one task, edited in place.
 *
 * RENDERS INSIDE THE TASK DIALOG'S <form>. So: no <form> of its own, every
 * button is type="button", and Enter inside the picker is stopped before it
 * reaches the outer form's React handlers (the popup is portalled, so the
 * browser's implicit submit cannot fire, but React events still bubble
 * through the portal to the dialog's tree).
 *
 * Saves on every toggle rather than with the dialog's Save: these are their
 * own rows (task_label_links / task_components), not task columns, and making
 * them wait on the dialog would mean a cancelled dialog silently drops them.
 * Optimistic, with rollback to the last set the SERVER confirmed — and saves
 * per kind are chained, so two quick toggles can never land out of order.
 */

type Kind = 'labels' | 'components'
type Option = { id: string; name: string; colorSlot?: number | null }

const CHIP_BASE =
  'inline-flex max-w-44 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium'

/** One label, coloured by its stored slot. Reused by the board card. */
export function LabelChip({ name, colorSlot }: { name: string; colorSlot: number | null }) {
  return (
    <span className={cn(CHIP_BASE, labelChipClasses(colorSlot))} title={name}>
      <span className="truncate">{name}</span>
    </span>
  )
}

async function safely<T>(call: () => Promise<ActionResult<T>>, fallback: string): Promise<ActionResult<T>> {
  // A rejected server-action promise (network drop, deploy mid-request) must
  // end in the same rollback path as an err(), not an unhandled rejection
  // that leaves the optimistic chip looking saved.
  try {
    return await call()
  } catch {
    return { ok: false, error: fallback }
  }
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

export function TaskTagsField({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const [load, setLoad] = React.useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = React.useState(0)
  const [labels, setLabels] = React.useState<TaskLabel[]>([])
  const [components, setComponents] = React.useState<TaskTag[]>([])
  const [selected, setSelected] = React.useState<Record<Kind, string[]>>({ labels: [], components: [] })

  // Mirrors of state for the save chain, which runs outside render and must
  // see the newest selection, not the one its closure was born with.
  const current = React.useRef<Record<Kind, string[]>>({ labels: [], components: [] })
  const confirmed = React.useRef<Record<Kind, string[]>>({ labels: [], components: [] })
  const chain = React.useRef<Record<Kind, Promise<void>>>({
    labels: Promise.resolve(),
    components: Promise.resolve(),
  })
  const latest = React.useRef<Record<Kind, number>>({ labels: 0, components: 0 })

  React.useEffect(() => {
    let cancelled = false
    void safely<TaskTags>(() => listTaskTags(taskId), 'Could not load labels — check your connection').then(
      (result) => {
        if (cancelled) return
        if (!result.ok) {
          setLoad({ status: 'error', message: result.error })
          return
        }
        const ids = {
          labels: result.data.selectedLabelIds,
          components: result.data.selectedComponentIds,
        }
        current.current = ids
        confirmed.current = ids
        setLabels(result.data.labels)
        setComponents(result.data.components)
        setSelected(ids)
        setLoad({ status: 'ready' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [taskId, reloadKey])

  const commit = React.useCallback(
    (kind: Kind, next: string[]) => {
      current.current = { ...current.current, [kind]: next }
      setSelected((prev) => ({ ...prev, [kind]: next }))
      latest.current[kind] += 1
      const seq = latest.current[kind]
      chain.current[kind] = chain.current[kind].then(async () => {
        const result = await safely<unknown>(
          () => (kind === 'labels' ? setTaskLabels(taskId, next) : setTaskComponents(taskId, next)),
          'Could not save — check your connection',
        )
        if (result.ok) {
          confirmed.current = { ...confirmed.current, [kind]: next }
          return
        }
        toast.error(result.error)
        // Only the newest save rolls back: an older failure followed by a
        // queued newer save would otherwise yank the chips back under the
        // person's cursor for a set that is about to be written anyway.
        if (seq === latest.current[kind]) {
          const back = confirmed.current[kind]
          current.current = { ...current.current, [kind]: back }
          setSelected((prev) => ({ ...prev, [kind]: back }))
        }
      })
    },
    [taskId],
  )

  const toggle = React.useCallback(
    (kind: Kind, id: string) => {
      const now = current.current[kind]
      if (!now.includes(id) && now.length >= MAX_TAGS_PER_TASK) {
        toast.error(`A task can carry at most ${MAX_TAGS_PER_TASK} ${kind}`)
        return
      }
      commit(kind, toggleId(now, id))
    },
    [commit],
  )

  const create = React.useCallback(
    async (kind: Kind, name: string): Promise<boolean> => {
      if (current.current[kind].length >= MAX_TAGS_PER_TASK) {
        toast.error(`A task can carry at most ${MAX_TAGS_PER_TASK} ${kind}`)
        return false
      }
      const result = await safely<TaskLabel | TaskTag>(
        () => (kind === 'labels' ? createLabel(taskId, name) : createComponent(taskId, name)),
        'Could not create it — check your connection',
      )
      if (!result.ok) {
        toast.error(result.error)
        return false
      }
      const byName = (a: Option, b: Option) => a.name.localeCompare(b.name)
      if (kind === 'labels') setLabels((prev) => [...prev, result.data as TaskLabel].sort(byName))
      else setComponents((prev) => [...prev, result.data].sort(byName))
      // Created to be used: the person typed it into THIS task's picker.
      commit(kind, [...current.current[kind], result.data.id])
      return true
    },
    [commit, taskId],
  )

  if (load.status === 'loading') {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label="Loading labels and components">
        {['Labels', 'Components'].map((title) => (
          <div key={title} className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
            <div className="flex gap-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (load.status === 'error') {
    return (
      <div role="alert" className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{load.message}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLoad({ status: 'loading' })
            setReloadKey((k) => k + 1)
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <TagRow
        kind="labels"
        title="Labels"
        noun="label"
        options={labels}
        selected={selected.labels}
        canEdit={canEdit}
        onToggle={(id) => toggle('labels', id)}
        onCreate={(name) => create('labels', name)}
        colored
      />
      <TagRow
        kind="components"
        title="Components"
        noun="component"
        options={components}
        selected={selected.components}
        canEdit={canEdit}
        onToggle={(id) => toggle('components', id)}
        onCreate={(name) => create('components', name)}
      />
    </div>
  )
}

const CREATE_VALUE = '__create__'

function TagRow({
  kind,
  title,
  noun,
  options,
  selected,
  canEdit,
  onToggle,
  onCreate,
  colored = false,
}: {
  kind: Kind
  title: string
  noun: string
  options: Option[]
  selected: string[]
  canEdit: boolean
  onToggle: (id: string) => void
  onCreate: (name: string) => Promise<boolean>
  colored?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const titleId = React.useId()
  const listId = React.useId()

  const byId = React.useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  // Ids the project no longer has (deleted between load and now) are dropped
  // from display rather than shown as a nameless chip.
  const chips = selected.map((id) => byId.get(id)).filter((o): o is Option => o !== undefined)
  const typed = normaliseTagName(query)
  const canCreate = canEdit && typed.length > 0 && !hasTagNamed(options, typed)

  const runCreate = async () => {
    if (creating || !canCreate) return
    setCreating(true)
    const created = await onCreate(typed)
    setCreating(false)
    if (created) setQuery('')
  }

  return (
    <div role="group" aria-labelledby={titleId} className="grid grid-cols-[6.5rem_1fr] items-start gap-2">
      <span id={titleId} className="pt-0.5 text-xs font-medium text-muted-foreground">
        {title}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {chips.length === 0 && !canEdit ? <span className="text-xs text-muted-foreground">None</span> : null}
        {chips.map((chip) => (
          <span
            key={chip.id}
            className={cn(CHIP_BASE, labelChipClasses(colored ? (chip.colorSlot ?? null) : null))}
            title={chip.name}
          >
            <span className="truncate">{chip.name}</span>
            {canEdit ? (
              // A real button so removal is keyboard-reachable.
              <button
                type="button"
                aria-label={`Remove ${noun} ${chip.name}`}
                onClick={() => onToggle(chip.id)}
                className="-mr-1 rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <XIcon aria-hidden className="size-3" />
              </button>
            ) : null}
          </span>
        ))}

        {canEdit ? (
          <Popover
            open={open}
            onOpenChange={(next) => {
              setOpen(next)
              if (!next) setQuery('')
            }}
          >
            <PopoverTrigger
              render={
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-haspopup="listbox"
                  aria-label={`Add ${noun}`}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-solid hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              }
            >
              <PlusIcon aria-hidden className="size-3" />
              {chips.length === 0 ? `Add ${noun}` : <span className="sr-only">{`Add ${noun}`}</span>}
            </PopoverTrigger>
            <PopoverContent align="start" className="min-w-64 p-0">
              <Command
                // Matching on the NAME: item values are ids (two labels may
                // differ only in case on another project, and ids are what
                // the toggle needs). The create row always survives filtering.
                filter={(value, search) => {
                  if (value === CREATE_VALUE) return 1
                  const option = byId.get(value)
                  if (!option) return 0
                  return option.name.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
                }}
                onKeyDown={(event) => {
                  // stopPropagation only — cmdk runs its own Enter handling
                  // after this unless defaultPrevented, so the pick still
                  // happens; the dialog's form just never hears it.
                  if (event.key === 'Enter') event.stopPropagation()
                }}
              >
                <CommandInput
                  placeholder={`Search or create a ${noun}…`}
                  value={query}
                  onValueChange={setQuery}
                  maxLength={60}
                />
                <CommandList id={listId}>
                  {canCreate ? null : (
                    <CommandEmpty>
                      {options.length === 0
                        ? `No ${kind} in this project yet — type to create one.`
                        : `No ${noun} matches.`}
                    </CommandEmpty>
                  )}
                  {options.length > 0 ? (
                    <CommandGroup>
                      {options.map((option) => {
                        const picked = selected.includes(option.id)
                        return (
                          <CommandItem
                            key={option.id}
                            value={option.id}
                            data-checked={picked}
                            onSelect={() => onToggle(option.id)}
                          >
                            {colored ? (
                              <span
                                aria-hidden
                                className={cn('size-2.5 shrink-0 rounded-full', labelDotClasses(option.colorSlot ?? null))}
                              />
                            ) : null}
                            <span className="truncate">{option.name}</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  ) : null}
                  {canCreate ? (
                    <CommandGroup>
                      <CommandItem
                        value={CREATE_VALUE}
                        forceMount
                        disabled={creating}
                        onSelect={() => void runCreate()}
                      >
                        <PlusIcon aria-hidden />
                        <span className="truncate">
                          {creating ? 'Creating…' : `Create “${typed}”`}
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  )
}
