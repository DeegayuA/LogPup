'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Archive, Download, PawPrint, Trash2, UserCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { archiveApp, deleteApp, updateApp } from '@/features/apps/actions'
import { bulkArchiveApps, bulkDeleteApps, bulkSetAppLead } from '@/features/admin/bulk-actions'
import {
  headerSelectionState,
  pruneSelection,
  selectRange,
  toggleAllSelected,
  toggleSelected,
} from '@/features/admin/bulk-logic'
import { BulkBar, toastBulkResult } from '@/features/admin/components/bulk-bar'
import { HeaderCheckbox, RowCheckbox } from '@/features/admin/components/bulk-select'
import { downloadCsv } from '@/features/admin/components/csv-download'
import type { ActiveUser } from '@/features/people/queries'
import type { AppWithMembers } from '@/features/apps/queries'

const STATUS_VARIANT = {
  active: 'default',
  paused: 'outline',
  archived: 'secondary',
} as const

const STATUS_LABEL: Record<AppWithMembers['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

const NO_LEAD = 'none'
const APPS = { one: 'app', many: 'apps' }

/**
 * Lead picker. Optional, hence the NO_LEAD sentinel — Base UI's Select has no
 * concept of "unset" once a value exists, so the absence has to be a value.
 *
 * The function child on SelectValue is not optional: without it the trigger
 * renders the raw `value`, which here is a UUID. A lead who has since been
 * deactivated is not in `users`, so that case is labelled honestly rather than
 * shown as "No lead".
 */
function LeadSelect({
  value,
  users,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string | null
  users: ActiveUser[]
  disabled?: boolean
  ariaLabel: string
  onChange: (leadId: string | null) => void
}) {
  return (
    <Select
      value={value ?? NO_LEAD}
      disabled={disabled}
      onValueChange={(next) => onChange(!next || next === NO_LEAD ? null : next)}
    >
      <SelectTrigger size="sm" aria-label={ariaLabel} className="w-full">
        <SelectValue>
          {(v: string) =>
            v === NO_LEAD
              ? 'No lead'
              : (users.find((user) => user.id === v)?.name ?? 'Lead — deactivated')
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_LEAD}>No lead</SelectItem>
        {value && !users.some((user) => user.id === value) ? (
          <SelectItem value={value}>Current lead — deactivated</SelectItem>
        ) : null}
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Same shape as LeadSelect, minus the sentinel: an app must have a PM. */
function PmSelect({
  value,
  users,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string
  users: ActiveUser[]
  disabled?: boolean
  ariaLabel: string
  onChange: (pmId: string) => void
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next)}
    >
      <SelectTrigger size="sm" aria-label={ariaLabel} className="w-full">
        <SelectValue>
          {(v: string) => users.find((user) => user.id === v)?.name ?? 'PM — deactivated'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {!users.some((user) => user.id === value) ? (
          <SelectItem value={value}>Current PM — deactivated</SelectItem>
        ) : null}
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-2xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

const CSV_HEADERS = ['Name', 'Slug', 'Status', 'Lead', 'PM', 'Members', 'Created'] as const

export function AppsTable({
  apps,
  activeUsers,
}: {
  apps: AppWithMembers[]
  activeUsers: ActiveUser[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [picked, setPicked] = useState<string[]>([])
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false)
  const [draftLeadId, setDraftLeadId] = useState<string | null>(null)

  const ids = useMemo(() => apps.map((app) => app.id), [apps])

  // Derived, not stored: a bulk action revalidates this page, so rows vanish
  // underneath the selection. Pruning at render means the count in the bar can
  // never claim rows that are gone, without an effect that writes state back.
  const selected = useMemo(() => pruneSelection(picked, ids), [picked, ids])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  function toggleRow(id: string, range: boolean) {
    setPicked((current) =>
      range && anchorId
        ? selectRange(pruneSelection(current, ids), ids, anchorId, id)
        : toggleSelected(pruneSelection(current, ids), id),
    )
    setAnchorId(id)
  }

  function runRow(label: string, run: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      try {
        const res = await run()
        if (!res.ok) {
          toast.error(res.error ?? 'Something went wrong. Please try again.')
          return
        }
        toast.success(label)
        router.refresh()
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  function runBulk(
    run: () => Promise<Awaited<ReturnType<typeof bulkArchiveApps>>>,
    doneVerb: string,
  ) {
    startTransition(async () => {
      try {
        const res = await run()
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toastBulkResult(res.data, doneVerb, APPS)
        // The selection is deliberately NOT cleared: rows the guards refused
        // are still selected, so the operator can see what did not happen and
        // act on it, instead of the batch quietly resetting to nothing.
        router.refresh()
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  function exportSelected() {
    const rows = apps
      .filter((app) => selectedSet.has(app.id))
      .map((app) => [
        app.name,
        app.slug,
        STATUS_LABEL[app.status],
        app.leadName,
        app.pmName,
        app.members.length,
        new Date(app.createdAt).toISOString().slice(0, 10),
      ])
    downloadCsv('apps', CSV_HEADERS, rows)
  }

  function rowActions(app: AppWithMembers) {
    const isArchived = app.status === 'archived'
    return (
      <div className="flex items-center gap-0.5">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isArchived || isPending}
                aria-label={`Archive ${app.name}`}
              />
            }
          >
            <Archive aria-hidden className="size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive {app.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This marks the app as archived. It stays in the system and can be restored
                later by changing its status.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={() => runRow('App archived', () => archiveApp(app.id))}
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                aria-label={`Delete ${app.name}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              />
            }
          >
            <Trash2 aria-hidden className="size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {app.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                It disappears from every view — index, board, search and dashboards — but
                nothing is destroyed: an admin can restore it from Trash, sprints and tasks
                included.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={() => runRow('App moved to trash', () => deleteApp(app.id))}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-8 text-center">
        <PawPrint className="size-5 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium">No apps yet.</p>
        <p className="text-xs text-muted-foreground">
          Add one from the Apps page to manage it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col">
      <BulkBar count={selected.length} noun={APPS} onClear={() => setPicked([])}>
        <Popover open={leadPopoverOpen} onOpenChange={setLeadPopoverOpen}>
          <PopoverTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
            <UserCog aria-hidden className="size-3.5" />
            Lead
          </PopoverTrigger>
          <PopoverContent align="start">
            <PopoverHeader>
              <PopoverTitle>Reassign lead</PopoverTitle>
              <PopoverDescription>
                Applies to all {selected.length} selected. Apps you cannot edit are skipped.
              </PopoverDescription>
            </PopoverHeader>
            <LeadSelect
              value={draftLeadId}
              users={activeUsers}
              ariaLabel="New lead for the selected apps"
              onChange={setDraftLeadId}
            />
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                setLeadPopoverOpen(false)
                runBulk(() => bulkSetAppLead({ ids: selected, leadId: draftLeadId }), 'reassigned')
              }}
            >
              Apply
            </Button>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" disabled={isPending} onClick={exportSelected}>
          <Download aria-hidden className="size-3.5" />
          CSV
        </Button>

        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
            <Archive aria-hidden className="size-3.5" />
            Archive
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive {selected.length} apps?</AlertDialogTitle>
              <AlertDialogDescription>
                They stay in the system and can be restored by changing their status. Any app
                that is already archived is reported as skipped.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={() => runBulk(() => bulkArchiveApps(selected), 'archived')}
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                className="border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
              />
            }
          >
            <Trash2 aria-hidden className="size-3.5" />
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selected.length} apps?</AlertDialogTitle>
              <AlertDialogDescription>
                They disappear from every view but nothing is destroyed — an admin can restore
                each one from Trash, sprints and tasks included.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={() => runBulk(() => bulkDeleteApps(selected), 'deleted')}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </BulkBar>

      {/* PHONE: one card per app. Four columns of selects squeezed into 375px
          is a sideways scroll nobody discovers, so the same controls stack. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {apps.map((app) => (
          <li
            key={app.id}
            className={`flex flex-col gap-3 rounded-xl border border-border p-3 ${
              app.status === 'archived' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-2">
              <RowCheckbox
                checked={selectedSet.has(app.id)}
                label={`Select ${app.name}`}
                onToggle={(range) => toggleRow(app.id, range)}
                className="mt-1"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium break-words">{app.name}</span>
                <Badge variant={STATUS_VARIANT[app.status]} className="self-start">
                  {STATUS_LABEL[app.status]}
                </Badge>
              </div>
              {rowActions(app)}
            </div>
            <div className="flex flex-col gap-2">
              <Labelled label="Lead">
                <LeadSelect
                  value={app.leadId}
                  users={activeUsers}
                  disabled={isPending}
                  ariaLabel={`Lead for ${app.name}`}
                  onChange={(leadId) =>
                    runRow('Lead updated', () => updateApp(app.id, { leadId }))
                  }
                />
              </Labelled>
              <Labelled label="PM">
                <PmSelect
                  value={app.pmId}
                  users={activeUsers}
                  disabled={isPending}
                  ariaLabel={`PM for ${app.name}`}
                  onChange={(pmId) => runRow('PM updated', () => updateApp(app.id, { pmId }))}
                />
              </Labelled>
            </div>
          </li>
        ))}
      </ul>

      {/* TABLET AND UP: `table-fixed` is the structural fix for the sideways
          scroll — column widths stop being decided by their content, so a long
          app name or a long person's name wraps inside its cell instead of
          pushing the table (and the page) wider than the viewport. Lead and PM
          share one stacked cell for the same reason: two full-width selects
          side by side is what made the old five-column layout overflow. */}
      <div className="hidden min-w-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">
                <HeaderCheckbox
                  state={headerSelectionState(selected, ids)}
                  label="Select all apps"
                  onToggle={() => setPicked((current) => toggleAllSelected(current, ids))}
                />
              </TableHead>
              <TableHead>App</TableHead>
              <TableHead className="w-[17rem]">Lead and PM</TableHead>
              <TableHead className="w-[5.5rem] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow
                key={app.id}
                data-state={selectedSet.has(app.id) ? 'selected' : undefined}
                className={app.status === 'archived' ? 'opacity-60' : undefined}
              >
                <TableCell>
                  <RowCheckbox
                    checked={selectedSet.has(app.id)}
                    label={`Select ${app.name}`}
                    onToggle={(range) => toggleRow(app.id, range)}
                  />
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium break-words">{app.name}</span>
                    <Badge variant={STATUS_VARIANT[app.status]} className="self-start">
                      {STATUS_LABEL[app.status]}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-col gap-1.5">
                    <Labelled label="Lead">
                      <LeadSelect
                        value={app.leadId}
                        users={activeUsers}
                        disabled={isPending}
                        ariaLabel={`Lead for ${app.name}`}
                        onChange={(leadId) =>
                          runRow('Lead updated', () => updateApp(app.id, { leadId }))
                        }
                      />
                    </Labelled>
                    <Labelled label="PM">
                      <PmSelect
                        value={app.pmId}
                        users={activeUsers}
                        disabled={isPending}
                        ariaLabel={`PM for ${app.name}`}
                        onChange={(pmId) =>
                          runRow('PM updated', () => updateApp(app.id, { pmId }))
                        }
                      />
                    </Labelled>
                  </div>
                </TableCell>
                <TableCell className="align-top text-right">
                  <div className="flex justify-end">{rowActions(app)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
