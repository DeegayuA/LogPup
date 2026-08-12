'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
  const [isPending, startTransition] = useTransition()

  function handleRemove(assignmentId: string) {
    startTransition(async () => {
      const res = await removeAssignment(assignmentId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Member removed')
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-heading text-base font-medium">Team</h2>
          {team.length > 0 ? (
            <span className="font-mono text-xs text-muted-foreground">{team.length}</span>
          ) : null}
        </div>
        {isAdmin ? (
          <AssignDialog
            appId={appId}
            activeUsers={activeUsers}
            trigger={
              <Button variant="outline" size="sm">
                <Plus /> Add member
              </Button>
            }
          />
        ) : null}
      </div>
      {team.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">No one&apos;s on this app yet.</p>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? 'Add the first member to get things moving.' : 'Ask an admin to assign someone.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {team.map((member) => (
            <li key={member.assignmentId} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar size="sm">
                {member.avatarUrl ? (
                  <AvatarImage src={member.avatarUrl} alt={member.name} />
                ) : null}
                <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/people/${member.userId}`}
                  title={member.email}
                  className="w-fit max-w-full truncate rounded-sm text-sm font-medium underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {member.name}
                </Link>
                <span className="truncate text-xs text-muted-foreground">{member.role}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(member.allocationPct, 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                  {member.allocationPct}%
                </span>
              </div>
              {isAdmin ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  <AssignDialog
                    appId={appId}
                    activeUsers={activeUsers}
                    assignment={member}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit assignment"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove member"
                          className="text-muted-foreground hover:text-destructive"
                        />
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
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
