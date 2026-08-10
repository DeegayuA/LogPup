'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { removeAssignment } from '@/features/people/actions'
import { AssignDialog } from '@/features/people/components/assign-dialog'
import type { ActiveUser, TeamMember } from '@/features/people/queries'

export function TeamPanel({
  appId,
  team,
  activeUsers,
  isAdmin,
}: {
  appId: string
  team: TeamMember[]
  activeUsers: ActiveUser[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRemove(assignmentId: string) {
    startTransition(async () => {
      const res = await removeAssignment(assignmentId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Member removed')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-medium">Team</h2>
        {isAdmin ? (
          <AssignDialog
            appId={appId}
            activeUsers={activeUsers}
            trigger={
              <Button size="sm">
                <Plus /> Add member
              </Button>
            }
          />
        ) : null}
      </div>
      {team.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one is assigned to this app yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Allocation</TableHead>
              {isAdmin ? <TableHead className="w-0" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((member) => (
              <TableRow key={member.assignmentId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      {member.avatarUrl ? (
                        <AvatarImage src={member.avatarUrl} alt={member.name} />
                      ) : null}
                      <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(member.allocationPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {member.allocationPct}%
                    </span>
                  </div>
                </TableCell>
                {isAdmin ? (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <AssignDialog
                        appId={appId}
                        activeUsers={activeUsers}
                        assignment={member}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="Edit assignment">
                            <Pencil />
                          </Button>
                        }
                      />
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Remove member" />
                          }
                        >
                          <Trash2 />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes them from the app&apos;s team. They can be re-added
                              later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={isPending}
                              onClick={() => handleRemove(member.assignmentId)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
