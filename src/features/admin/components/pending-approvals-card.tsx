'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { CheckCheck, UserRoundCheck, UserRoundX } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { approveUser, rejectUser } from '@/features/admin/actions'
import type { PendingUser } from '@/features/admin/queries'
import type { UserRole } from '@/features/auth/capabilities'

function PendingRow({
  user,
  onRemoveOptimistically,
}: {
  user: PendingUser
  /** The parent's useOptimistic updater — called INSIDE this row's transition
   *  so the overlay lives exactly as long as this row's own wait. */
  onRemoveOptimistically: (id: string) => void
}) {
  const [role, setRole] = useState<UserRole>('member')
  // PER-ROW transition, deliberately. One shared isPending used to disable
  // the Approve/Reject/role controls on every other signup while any one was
  // being decided — serializing a queue whose rows are optimistic and
  // independent.
  const [isPending, startTransition] = useTransition()

  function decide(run: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      onRemoveOptimistically(user.id)
      try {
        const res = await run()
        if (!res.ok) {
          toast.error(res.error ?? 'Something went wrong — try again')
          return
        }
        toast.success(done)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleApprove() {
    decide(() => approveUser(user.id, role), `${user.name} approved as ${role}`)
  }

  function handleReject() {
    decide(() => rejectUser(user.id), `${user.name} rejected`)
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar size="sm">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">{user.email}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">{user.phone ?? 'No phone'}</span>
        <div className="flex flex-wrap gap-1">
          {user.orgTags.length > 0 ? (
            user.orgTags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))
          ) : (
            <span>No organization</span>
          )}
        </div>
        <span className="font-mono tabular-nums" title={user.createdAt.toISOString()}>
          Signed up {format(user.createdAt, 'MMM d, yyyy')}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={role}
          disabled={isPending}
          onValueChange={(value) => setRole(value as UserRole)}
        >
          <SelectTrigger size="sm" aria-label={`Role for ${user.name}`} className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" disabled={isPending} onClick={handleApprove}>
          <UserRoundCheck /> Approve
        </Button>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="ghost" size="sm" disabled={isPending} />}>
            <UserRoundX /> Reject
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject {user.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {user.email} will be permanently denied sign-in. There&apos;s no undo for
                this from here — they would need a fresh, admin-created account to get in
                later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleReject}>
                {isPending ? 'Rejecting…' : 'Reject'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}

/**
 * OPTIMISTIC UPDATES — the decision is the interesting part, not the wait.
 *
 * Approving used to mean: await `approveUser`, then `router.refresh()`, then
 * watch the row finally go. On the dashboard that second step re-ran the
 * page's entire query batch before anything moved on screen, so a decision
 * that took an admin a quarter of a second to make took the UI most of a
 * second to acknowledge — and an admin working through a queue of signups felt
 * every one of them.
 *
 * Now the row leaves the moment it is acted on. Two things make that safe:
 *
 * - `router.refresh()` is gone, and is NOT missing. `approveUser`/`rejectUser`
 *   both end in `revalidateAdminPaths()` (`/admin`, `/people`, `/`), and Next
 *   ships the re-rendered RSC payload for the current route back in the
 *   action's own response — so the refresh was always a second, redundant
 *   render of the same page, not the thing that made the list correct.
 * - Rollback is automatic and needs no undo bookkeeping. A `useOptimistic`
 *   overlay only lives as long as its transition; when the action settles the
 *   overlay drops and the list falls back to whatever the server actually
 *   sent. Succeeded → the fresh payload already omits the row, so nothing
 *   visibly changes. Failed → the server list still contains it, so the row
 *   reappears under the error toast, which is exactly the truth.
 */
export function PendingApprovalsCard({ users }: { users: PendingUser[] }) {
  const [visibleUsers, removeOptimistically] = useOptimistic(
    users,
    (current: PendingUser[], removedId: string) => current.filter((u) => u.id !== removedId),
  )

  return (
    <Card className={visibleUsers.length > 0 ? 'ring-primary/30' : undefined}>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          Pending approvals
          {visibleUsers.length > 0 ? (
            <Badge variant="default">{visibleUsers.length}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Accounts created by open Google self-signup, waiting on a role and a decision.
          Rejecting is final — there&apos;s no undo from here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visibleUsers.length === 0 ? (
          <EmptyState
            icon={CheckCheck}
            title="Nothing waiting on you."
            description="New self-signups will show up here for approval."
            className="rounded-xl border border-dashed border-border"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleUsers.map((user) => (
              <PendingRow
                key={user.id}
                user={user}
                onRemoveOptimistically={removeOptimistically}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
