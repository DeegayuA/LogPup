'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { CheckCheck, UserRoundCheck, UserRoundX } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function PendingRow({ user }: { user: PendingUser }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState<'admin' | 'member'>('member')

  function handleApprove() {
    startTransition(async () => {
      try {
        const res = await approveUser(user.id, role)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`${user.name} approved as ${role}`)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleReject() {
    startTransition(async () => {
      try {
        const res = await rejectUser(user.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`${user.name} rejected`)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
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
          onValueChange={(value) => setRole(value as 'admin' | 'member')}
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

export function PendingApprovalsCard({ users }: { users: PendingUser[] }) {
  return (
    <Card className={users.length > 0 ? 'ring-primary/30' : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pending approvals
          {users.length > 0 ? <Badge variant="default">{users.length}</Badge> : null}
        </CardTitle>
        <CardDescription>
          Accounts created by open Google self-signup, waiting on a role and a decision.
          Rejecting is final — there&apos;s no undo from here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <CheckCheck className="size-5 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">Nothing waiting on you.</p>
            <p className="text-xs text-muted-foreground">
              New self-signups will show up here for approval.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((user) => (
              <PendingRow key={user.id} user={user} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
