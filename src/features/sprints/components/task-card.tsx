'use client'

import {
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type PointerEventHandler,
} from 'react'
import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CalendarClock, GripVertical } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { CardQuickMenu, type QuickMenuItem } from '@/components/shared/card-quick-menu'
import { InlineRename } from '@/components/shared/inline-rename'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_STATUSES,
  isDueToday,
  isOverdue,
} from '@/features/sprints/board-view'
import { isoDayAdd } from '@/features/people/iso-day'
import { deleteTask, updateTask } from '@/features/sprints/task-actions'
import type { TaskWithAssignee } from '@/features/sprints/queries'

// Priority 0 (none) draws nothing; the ramp climbs sage → ember → destructive
// per the redesign spec — no new hues.
const PRIORITY_BAR: Record<number, string | null> = {
  0: null,
  1: 'bg-chart-2',
  2: 'bg-chart-1',
  3: 'bg-destructive',
}

/** Matches the meetings calendar and the board's own DndContext: a plain
 *  click must still open the card, so a drag only starts once the pointer has
 *  actually travelled. */
export const DRAG_ACTIVATION_DISTANCE = 8

/**
 * `PRIORITY_LABEL` is written for the card face, where the surrounding column
 * and colour bar supply the noun ("High"). A menu item has no such context,
 * so put the noun back — except on 0, which is already a whole phrase. One
 * shared map, two readings, rather than a second copy of the labels here that
 * would drift the first time a level is renamed.
 */
function priorityMenuLabel(value: number): string {
  const label = PRIORITY_LABEL[value]
  return value === 0 ? label : `${label} priority`
}

/** A `date` column is a calendar day, not an instant. `new Date('2026-08-14')`
 *  parses as UTC midnight and renders as the 13th west of Greenwich; noon is
 *  far enough from either boundary to survive any offset. Same rule as
 *  roadmap.tsx and the app detail route. */
function formatDueDate(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), 'MMM d')
}

/**
 * The card's face, shared verbatim by the real card and the drag overlay —
 * one definition, so the thing under the cursor can never drift from the
 * thing in the column.
 */
function CardFace({
  task,
  todayIso,
  /** The real card renders the title itself when the user may rename it in
   *  place (the rename control cannot live inside the card's open-button —
   *  see TaskCard). Dropping the title here keeps ONE face rather than a
   *  second, forked copy for editable cards. */
  hideTitle,
}: {
  task: TaskWithAssignee
  todayIso: string
  hideTitle?: boolean
}) {
  const overdue = isOverdue(task, todayIso)
  const dueToday = isDueToday(task, todayIso)

  return (
    <>
      {hideTitle ? null : (
        <p className="line-clamp-2 text-sm leading-snug font-medium text-card-foreground">
          {task.title}
        </p>
      )}
      <div className="flex items-center gap-2">
        {task.dueDate ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 font-mono text-2xs tabular-nums',
              overdue
                ? 'text-destructive'
                : dueToday
                  ? 'text-warning'
                  : 'text-muted-foreground',
            )}
          >
            <CalendarClock className="size-3 shrink-0" aria-hidden />
            {formatDueDate(task.dueDate)}
          </span>
        ) : null}
        {task.priority > 0 ? (
          <span className="truncate text-2xs text-muted-foreground">
            {PRIORITY_LABEL[task.priority]}
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center">
          {task.assignee ? (
            <Avatar size="sm">
              {task.assignee.avatarUrl ? (
                <AvatarImage src={task.assignee.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback>{task.assignee.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          ) : (
            <span className="rounded-full border border-dashed border-border px-1.5 py-0.5 text-2xs text-muted-foreground">
              Unassigned
            </span>
          )}
        </span>
      </div>
    </>
  )
}

/**
 * Everything the card says, spelled out for a screen reader in one string.
 *
 * The visible face leans on truncation, an avatar and a colour bar, none of
 * which survive the accessible tree: priority is otherwise a coloured stripe
 * and nothing else, and "overdue" is otherwise red text and nothing else
 * (WCAG 1.4.1).
 */
function cardLabel(task: TaskWithAssignee, todayIso: string): string {
  return [
    task.title,
    task.assignee ? `assigned to ${task.assignee.name}` : 'unassigned',
    task.priority > 0 ? `${PRIORITY_LABEL[task.priority]} priority` : null,
    task.dueDate
      ? `${isOverdue(task, todayIso) ? 'overdue, was due' : isDueToday(task, todayIso) ? 'due today,' : 'due'} ${formatDueDate(task.dueDate)}`
      : null,
  ]
    .filter(Boolean)
    .join(', ')
}

export function TaskCardFace({
  task,
  todayIso,
}: {
  task: TaskWithAssignee
  todayIso: string
}) {
  const bar = PRIORITY_BAR[task.priority]
  return (
    <div className="relative flex w-64 flex-col gap-2 overflow-hidden rounded-lg border bg-card p-3 text-left shadow-md">
      {bar ? <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', bar)} /> : null}
      <CardFace task={task} todayIso={todayIso} />
    </div>
  )
}

export function TaskCard({
  task,
  draggable,
  isAdmin,
  team,
  selected,
  selectionMode,
  todayIso,
  onOpen,
  onToggleSelect,
}: {
  task: TaskWithAssignee
  /** Whether THIS user may move/edit/reassign this specific card — the same
      `canMoveTask` check the board already uses to decide draggability, and
      the quick menu's assign/priority/status items respect the identical
      gate rather than a separate rule. */
  draggable: boolean
  /** Deleting is the one card action that is not covered by `draggable`: an
   *  assignee may move and re-prioritise their own card but never destroy
   *  it, which is exactly what `deleteTask` enforces server-side. */
  isAdmin: boolean
  /** The roster the quick menu's reassign items are built from, so a card can
   *  change hands without opening the dialog. */
  team: { userId: string; name: string }[]
  selected: boolean
  /** True once anything is selected: checkboxes are permanently visible while
   *  a selection exists, so the set you are building can't be lost to a
   *  hover state you have to keep re-finding. */
  selectionMode: boolean
  todayIso: string
  onOpen: (task: TaskWithAssignee) => void
  onToggleSelect: (taskId: string) => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  // dnd-kit still needs a stable sortable registration even for non-draggable
  // cards (they must remain valid drop targets within the column's
  // SortableContext) — `disabled` just suppresses the drag listeners/attrs.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
  })

  // Where the pointer went down, so a drag that happens to end back over the
  // card isn't ALSO delivered as a click that pops the dialog open. Mirrors
  // the sensor's own activation distance. Same fix as the meetings calendar.
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  }

  // The quick menu's edits are NOT part of the board's optimistic move state
  // (that one models a drag: a rank plus a column). They are one-field writes
  // that the server revalidation paints, so they refresh rather than guess.
  function runUpdate(patch: Record<string, unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        const res = await updateTask(task.id, patch)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(successMessage)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await deleteTask(task.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Task deleted')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const items: QuickMenuItem[] = []
  if (draggable) {
    for (const status of TASK_STATUSES) {
      if (status === task.status) continue
      items.push({
        type: 'item',
        key: `status-${status}`,
        label: `Move to ${STATUS_LABEL[status]}`,
        onSelect: () => runUpdate({ status }, `Moved to ${STATUS_LABEL[status]}`),
      })
    }
    items.push({ type: 'separator', key: 'sep-due' })
    // Due date is the most common overdue-recovery edit, and it used to be
    // the ONLY per-card field with no 2-click path — dialog round trip every
    // time. Two absolute targets (tomorrow / a week out), named with the
    // date they resolve to so nothing is applied sight-unseen.
    const tomorrow = isoDayAdd(todayIso, 1)
    const nextWeek = isoDayAdd(todayIso, 7)
    items.push({
      type: 'item',
      key: 'due-tomorrow',
      label: `Due tomorrow (${formatDueDate(tomorrow)})`,
      onSelect: () => runUpdate({ dueDate: tomorrow }, `Due ${formatDueDate(tomorrow)}`),
    })
    items.push({
      type: 'item',
      key: 'due-next-week',
      label: `Due in a week (${formatDueDate(nextWeek)})`,
      onSelect: () => runUpdate({ dueDate: nextWeek }, `Due ${formatDueDate(nextWeek)}`),
    })
    if (task.dueDate) {
      items.push({
        type: 'item',
        key: 'due-clear',
        label: 'Remove due date',
        onSelect: () => runUpdate({ dueDate: null }, 'Due date removed'),
      })
    }
    items.push({ type: 'separator', key: 'sep-priority' })
    for (const key of Object.keys(PRIORITY_LABEL)) {
      const value = Number(key)
      if (value === task.priority) continue
      items.push({
        type: 'item',
        key: `priority-${value}`,
        label: priorityMenuLabel(value),
        onSelect: () => runUpdate({ priority: value }, 'Priority updated'),
      })
    }
    items.push({ type: 'separator', key: 'sep-assignee' })
    if (task.assignee) {
      items.push({
        type: 'item',
        key: 'unassign',
        label: 'Unassign',
        onSelect: () => runUpdate({ assigneeId: null }, 'Unassigned'),
      })
    }
    for (const member of team) {
      if (member.userId === task.assignee?.id) continue
      items.push({
        type: 'item',
        key: `assign-${member.userId}`,
        label: `Assign to ${member.name}`,
        onSelect: () => runUpdate({ assigneeId: member.userId }, `Assigned to ${member.name}`),
      })
    }
  }
  if (isAdmin) {
    if (items.length > 0) items.push({ type: 'separator', key: 'sep-delete' })
    items.push({
      type: 'item',
      key: 'delete',
      label: 'Delete',
      destructive: true,
      onSelect: handleDelete,
    })
  }

  const bar = PRIORITY_BAR[task.priority]

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div
        // Pointer listeners on the whole card so a mouse can grab it
        // anywhere, exactly as before. The KEYBOARD path deliberately does
        // not live here — see the grip button below. dnd-kit types its
        // listener map as bare `Function`s, hence the cast to the handler
        // React expects.
        onPointerDown={
          draggable
            ? (listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined)
            : undefined
        }
        // The quick menu renders nested inside this card, so a contextmenu
        // fired anywhere else on the card would never reach a listener on the
        // menu itself. Hence the listener here and the controlled open state
        // — the pattern CardQuickMenu documents.
        onContextMenu={(event) => {
          if (items.length === 0) return
          event.preventDefault()
          setMenuOpen(true)
        }}
        className={cn(
          // Both group names on purpose: this card's own affordances key on
          // `group/card`, while the shared CardQuickMenu reveals its ⋯ button
          // on the plain `group` that every card it is used on provides.
          'group group/card relative flex items-start gap-1.5 overflow-hidden rounded-lg border bg-card p-2 pl-3 shadow-xs',
          'transition-[border-color,box-shadow,opacity] duration-150',
          'hover:border-ring/60 has-focus-visible:border-ring',
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          selected && 'border-primary ring-2 ring-primary/30',
          // The card stays in place as a ghost while its overlay copy follows
          // the pointer, so the column's layout doesn't jump mid-drag.
          isDragging && 'opacity-40',
        )}
      >
        {bar ? <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', bar)} /> : null}

        <input
          type="checkbox"
          checked={selected}
          // A real checkbox, not a styled div: it is reachable by Tab,
          // toggles on Space, and announces its own state and name.
          aria-label={`Select ${task.title}`}
          onChange={() => onToggleSelect(task.id)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            'mt-0.5 size-4 shrink-0 cursor-pointer accent-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
            // Hidden until it is useful, but never hidden once a selection
            // exists — and always present for keyboard/AT.
            // pointer-coarse: touch has no hover, so without this the ONLY
            // entry point into multi-select would be invisible until a
            // selection already exists.
            !selectionMode &&
              'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
          )}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/*
            Rename in place, for anyone who may edit this card. It sits
            OUTSIDE the open-button below because it is its own tab stop and,
            once editing, an <input> — neither of which may be nested inside a
            button. The trade is that a single click on the title no longer
            opens the dialog (every other part of the face still does): the
            same separation the roadmap's label cell makes between a rename
            trigger and the navigation target beside it.
          */}
          {draggable ? (
            <InlineRename
              value={task.title}
              onSave={(next) => runUpdate({ title: next }, 'Task renamed')}
              ariaLabel="Task title"
              className="line-clamp-2 text-sm leading-snug font-medium text-card-foreground"
              maxLength={140}
            />
          ) : null}

          <button
            type="button"
            onPointerDown={(event) => {
              pointerStart.current = { x: event.clientX, y: event.clientY }
            }}
            onClick={(event) => {
              const from = pointerStart.current
              pointerStart.current = null
              if (
                from &&
                Math.hypot(event.clientX - from.x, event.clientY - from.y) >=
                  DRAG_ACTIVATION_DISTANCE
              ) {
                return
              }
              onOpen(task)
            }}
            className="flex min-w-0 flex-col gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">{cardLabel(task, todayIso)}</span>
            <span aria-hidden className="contents">
              <CardFace task={task} todayIso={todayIso} hideTitle={draggable} />
            </span>
          </button>
        </div>

        {/*
          The keyboard drag handle, and the reason Enter/Space on the card
          body can safely mean "open".
          dnd-kit's KeyboardSensor activates on Space/Enter over the element
          carrying its `attributes` — put those on the card itself and there
          is no key left to open a task with. A dedicated grip separates the
          two verbs: Tab to the grip, Space to lift, arrows to move, Space to
          drop, Escape to cancel. Rendered only when this user may actually
          move this card, because `attributes` carries
          aria-roledescription="draggable", which would be a lie otherwise.
        */}
        {draggable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${task.title}`}
            className={cn(
              'mt-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground outline-none',
              'transition-[color,opacity] duration-150 hover:text-foreground',
              'focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
              'cursor-grab active:cursor-grabbing',
              // Visible on touch: hover-revealed affordances do not exist on
              // a coarse pointer, and the grip is the drag hint there.
              'opacity-0 group-hover/card:opacity-100 pointer-coarse:opacity-100',
            )}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        ) : null}

        {/* `static` overrides the shared menu's own top-right absolute
            placement: on this card that corner is the drag grip's, so the ⋯
            rides in the flow beside it rather than on top of it. */}
        <CardQuickMenu
          items={items}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          label="Task actions"
          className="static mt-0.5 shrink-0"
        />
      </div>
    </li>
  )
}
