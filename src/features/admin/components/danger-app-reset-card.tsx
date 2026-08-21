'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SearchSelect } from '@/components/ui/search-select'
import { resetApp } from '@/features/admin/danger-actions'
import {
  purgeProgressMessage,
  resetAppPhrase,
  resetAppSummary,
} from '@/features/admin/danger-logic'
import { DangerConfirmControl } from '@/features/admin/components/danger-confirm-control'

export type DangerAppOption = {
  id: string
  name: string
  slug: string
  taskCount: number
  sprintCount: number
}

/**
 * Empties one project's board and leaves the project standing.
 *
 * The phrase is the project's address, the same confirmation DeleteAppCard
 * demands for the same reason — it names WHICH project, which is the error
 * this guards against. The counts beside each option are what make that
 * choice checkable before it is made.
 */
export function DangerAppResetCard({ apps }: { apps: DangerAppOption[] }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = apps.find((a) => a.id === selectedId) ?? null

  return (
    <DangerConfirmControl
      title="Reset a project's board"
      lead={
        <>
          Permanently deletes every sprint and task on one project, along with the
          check-ins reported against those sprints. The project, its team, its roles and
          its meetings all stay exactly as they are.
        </>
      }
      radius={resetAppSummary(selected?.name ?? 'the project', {
        sprints: selected?.sprintCount ?? 0,
        tasks: selected?.taskCount ?? 0,
      })}
      phrase={selected ? resetAppPhrase(selected.slug) : ''}
      phraseLabel="the project's address"
      openLabel="Reset this board…"
      confirmLabel="Delete the board"
      pendingLabel="Resetting…"
      emptyMessage={apps.length === 0 ? 'There are no projects to reset.' : null}
      onConfirm={async (confirm) => {
        if (!selected) return
        try {
          const res = await resetApp(selected.id, confirm)
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          toast.success(
            `${res.data.appName} — ${purgeProgressMessage(res.data, {
              one: 'sprint or task',
              many: 'sprints and tasks',
            })}`,
          )
          router.refresh()
        } catch {
          toast.error('Something went wrong — try again')
        }
      }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-2xs text-muted-foreground">
          Already-trashed sprints and tasks are left in Trash — empty the Trash for those.
        </span>
        {/* Searchable for the meeting picker's reason: destructive action over a
            list that grows. The slug rides in the hint and is searchable, which
            is what separates two projects sharing a display name. */}
        <SearchSelect
          value={selectedId ?? ''}
          onValueChange={setSelectedId}
          options={apps.map((app) => ({
            value: app.id,
            label: app.name,
            hint: `${app.slug} · ${app.taskCount} tasks · ${app.sprintCount} sprints`,
          }))}
          placeholder="Choose a project"
          searchPlaceholder="Search projects…"
          emptyText="No project by that name or slug."
          aria-label="Select a project to reset"
          className="h-9 max-w-sm"
        />
      </div>
    </DangerConfirmControl>
  )
}
