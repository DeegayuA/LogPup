'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import { archiveApp, updateApp } from '@/features/apps/actions'
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

export function AppsTable({
  apps,
  activeUsers,
}: {
  apps: AppWithMembers[]
  activeUsers: ActiveUser[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleLeadChange(appId: string, leadId: string) {
    startTransition(async () => {
      try {
        const res = await updateApp(appId, { leadId: leadId === NO_LEAD ? null : leadId })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Lead updated')
        router.refresh()
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  function handleArchive(appId: string) {
    startTransition(async () => {
      try {
        const res = await archiveApp(appId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('App archived')
        router.refresh()
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>App</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Lead</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {apps.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
              No apps yet. Add one from the Apps page to manage it here.
            </TableCell>
          </TableRow>
        ) : null}
        {apps.map((app) => {
          const isArchived = app.status === 'archived'
          return (
            <TableRow key={app.id} className={isArchived ? 'opacity-50' : undefined}>
              <TableCell className="font-medium">{app.name}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[app.status]}>{STATUS_LABEL[app.status]}</Badge>
              </TableCell>
              <TableCell>
                <Select
                  value={app.leadId ?? NO_LEAD}
                  disabled={isPending}
                  onValueChange={(value) => handleLeadChange(app.id, value ?? NO_LEAD)}
                >
                  <SelectTrigger size="sm" aria-label={`Lead for ${app.name}`}>
                    {/* Explicit label mapping — the raw id is the Select's `value`,
                        so without this the trigger falls back to rendering that id
                        (a UUID) instead of the lead's name. */}
                    <SelectValue>
                      {(value: string) => activeUsers.find((user) => user.id === value)?.name ?? 'No lead'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LEAD}>No lead</SelectItem>
                    {activeUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button variant="ghost" size="sm" disabled={isArchived || isPending} />
                    }
                  >
                    Archive
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive {app.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This marks the app as archived. It stays in the system and can be
                        restored later by changing its status.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction disabled={isPending} onClick={() => handleArchive(app.id)}>
                        Archive
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
