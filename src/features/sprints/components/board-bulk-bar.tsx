'use client'

import { CheckCheck, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES } from '@/features/sprints/board-view'
import type { SprintOption } from '@/features/sprints/actions'

export type BulkPatch = {
  status?: 'todo' | 'in_progress' | 'done'
  assigneeId?: string | null
  priority?: number
  sprintId?: string | null
}

/**
 * The multi-select action bar.
 *
 * It is a real region with a live count rather than a floating toast: the
 * set you have built is the most important thing on screen while it exists,
 * and it must survive scrolling the columns. Everything it offers is a
 * single patch applied to every selected card, so there is exactly one
 * server round trip per action and one thing to undo mentally.
 */
export function BoardBulkBar({
  count,
  sprintOptions,
  sprintOptionsFailed,
  team,
  isPending,
  onApply,
  onClear,
  onOpenSprintMenu,
}: {
  count: number
  /** Null until the app's sprints have been fetched — the menu says so
   *  rather than pretending the app has none. */
  sprintOptions: SprintOption[] | null
  /** True when the fetch failed. Without it, null reads as "still loading"
   *  and the menu spins a lie forever. */
  sprintOptionsFailed: boolean
  team: { userId: string; name: string }[]
  isPending: boolean
  onApply: (patch: BulkPatch) => void
  onClear: () => void
  onOpenSprintMenu: () => void
}) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-popover p-2 shadow-md"
    >
      <span className="inline-flex items-center gap-1.5 px-1 text-sm font-medium" aria-live="polite">
        <CheckCheck className="size-4 text-primary" aria-hidden />
        <span className="font-mono tabular-nums">{count}</span> selected
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={isPending} />}>
          {isPending ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          Set status
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TASK_STATUSES.map((status) => (
            <DropdownMenuItem key={status} onClick={() => onApply({ status })}>
              {STATUS_LABEL[status]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={isPending} />}>
          Assign
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuItem onClick={() => onApply({ assigneeId: null })}>
            Unassigned
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {team.length === 0 ? (
            <DropdownMenuLabel>Nobody is on this app yet</DropdownMenuLabel>
          ) : (
            team.map((member) => (
              <DropdownMenuItem
                key={member.userId}
                onClick={() => onApply({ assigneeId: member.userId })}
              >
                {member.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={isPending} />}>
          Priority
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {[3, 2, 1, 0].map((priority) => (
            <DropdownMenuItem key={priority} onClick={() => onApply({ priority })}>
              {PRIORITY_LABEL[priority]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu onOpenChange={(open) => open && onOpenSprintMenu()}>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={isPending} />}>
          Move to sprint
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuItem onClick={() => onApply({ sprintId: null })}>
            Backlog (no sprint)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {sprintOptions === null ? (
            <DropdownMenuLabel>
              {/* Reopening the menu re-runs the fetch — the trigger's
                  onOpenChange calls it every time — so the way out is a
                  sentence, not a button that would close the menu it lives
                  in and lose the selection context. */}
              {sprintOptionsFailed
                ? 'Couldn’t load sprints. Close this menu and open it again to retry.'
                : 'Loading sprints…'}
            </DropdownMenuLabel>
          ) : sprintOptions.length === 0 ? (
            <DropdownMenuLabel>This app has no sprints yet</DropdownMenuLabel>
          ) : (
            sprintOptions.map((sprint) => (
              <DropdownMenuItem
                key={sprint.id}
                onClick={() => onApply({ sprintId: sprint.id })}
              >
                {sprint.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        <X aria-hidden />
        Clear selection
      </Button>
    </div>
  )
}
