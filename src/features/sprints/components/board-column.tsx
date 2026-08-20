'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { canMoveTask } from '@/features/sprints/permissions'
import { TaskCard } from '@/features/sprints/components/task-card'
import { TaskComposer } from '@/features/sprints/components/task-composer'
import type { TaskWithAssignee } from '@/features/sprints/queries'
import type { BoardGroup, GroupPatch } from '@/features/sprints/board-view'
import type { UserRole } from '@/features/auth/capabilities'
import { isAdminRole } from '@/features/auth/capabilities'

/**
 * Column droppable ids are namespaced.
 *
 * dnd-kit resolves `over.id` against ONE flat registry shared by columns and
 * cards. Assignee columns are keyed by user id and cards by task id — both
 * UUIDs from different tables, so a collision is astronomically unlikely but
 * would be silent and unreproducible if it ever happened. The prefix makes
 * "is this a column or a card?" a fact rather than a guess.
 */
export const COLUMN_ID_PREFIX = 'col:'
export const columnDroppableId = (groupId: string) => `${COLUMN_ID_PREFIX}${groupId}`
export const groupIdFromDroppable = (id: string): string | null =>
  id.startsWith(COLUMN_ID_PREFIX) ? id.slice(COLUMN_ID_PREFIX.length) : null

export function BoardColumn({
  group,
  /** Share of the visible board this column holds, 0–1. Drawn as a hairline
   *  under the header so "everything is stuck in To do" is visible before
   *  anyone reads a single number. */
  share,
  composerPatch,
  team,
  composerPeople,
  appId,
  sprintId,
  currentUser,
  todayIso,
  selectedIds,
  selectionMode,
  filtersActive,
  onOpenTask,
  onToggleSelect,
}: {
  group: BoardGroup<TaskWithAssignee>
  share: number
  composerPatch: GroupPatch
  /** This app's members — the roster the card's reassign menu offers. */
  team: { userId: string; name: string }[]
  /** Everyone a name typed into the composer may resolve to: the whole
   *  workspace, flagged by whether they are on this app. Wider than `team` on
   *  purpose — see TaskComposer. */
  composerPeople: { id: string; name: string; onTeam: boolean }[]
  appId: string
  sprintId: string | null
  currentUser: { id: string; role: UserRole }
  todayIso: string
  selectedIds: ReadonlySet<string>
  selectionMode: boolean
  filtersActive: boolean
  onOpenTask: (task: TaskWithAssignee) => void
  onToggleSelect: (taskId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(group.id) })
  const headingId = `board-col-${group.id}`

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-64 flex-1 snap-start flex-col rounded-xl bg-muted/50 p-2"
    >
      <div className="flex flex-col gap-1.5 px-1 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          {/* h2, not h3: on the backlog view these columns sit directly under
              the page h1 (the sprint-name h2 only renders for a real sprint),
              so h3 here skipped a level in exactly the view with no h2. */}
          <h2 id={headingId} className="truncate font-heading text-sm font-semibold">
            {group.title}
          </h2>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {group.tasks.length}
          </span>
        </div>
        <div aria-hidden className="h-0.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary/50 transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col rounded-lg ring-2 ring-transparent ring-inset',
          // No transition on the drop highlight: during a drag the feedback
          // has to land the instant the pointer crosses the column edge.
          isOver && 'bg-accent ring-primary/40',
        )}
      >
        <SortableContext
          items={group.tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {group.tasks.length === 0 ? (
            <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
              {/* Two different emptinesses, two different next steps: an
                  empty column invites work, a filtered-out column tells you
                  the work exists and how to see it again. */}
              {filtersActive
                ? 'Nothing here matches the current filters.'
                : 'Nothing here yet — add one below, or drag one over.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable={canMoveTask(
                    currentUser.role,
                    currentUser.id,
                    task.assignee?.id ?? null,
                  )}
                  // The card's quick menu edits the same task the drag moves,
                  // so it is gated on the same `canMoveTask` answer — with the
                  // destructive item held back for admins, and the roster the
                  // reassign items need passed straight through.
                  isAdmin={isAdminRole(currentUser.role)}
                  team={team}
                  selected={selectedIds.has(task.id)}
                  selectionMode={selectionMode}
                  todayIso={todayIso}
                  onOpen={onOpenTask}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </ul>
          )}
        </SortableContext>
      </div>

      <TaskComposer
        patch={composerPatch}
        columnTitle={group.title}
        people={composerPeople}
        appId={appId}
        sprintId={sprintId}
      />
    </section>
  )
}
