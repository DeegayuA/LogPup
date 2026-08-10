'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
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
import { setUserActive, setUserRole } from '@/features/admin/actions'
import type { AdminUser } from '@/features/admin/queries'

const SELF_TITLE = 'Cannot change your own account'

export function UserTable({
  users,
  currentUserId,
}: {
  users: AdminUser[]
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(userId: string, role: 'admin' | 'member') {
    startTransition(async () => {
      try {
        const res = await setUserRole(userId, role)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Role updated')
        router.refresh()
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  function handleActiveChange(userId: string, active: boolean) {
    startTransition(async () => {
      try {
        const res = await setUserActive(userId, active)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(active ? 'User activated' : 'User deactivated')
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
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          return (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                    <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div title={isSelf ? SELF_TITLE : undefined} className="inline-block">
                  <Select
                    value={user.role}
                    disabled={isSelf || isPending}
                    onValueChange={(value) =>
                      handleRoleChange(user.id, value as 'admin' | 'member')
                    }
                  >
                    <SelectTrigger size="sm" aria-label={`Role for ${user.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TableCell>
              <TableCell>
                <div title={isSelf ? SELF_TITLE : undefined} className="inline-block">
                  <Switch
                    checked={user.active}
                    disabled={isSelf || isPending}
                    aria-label={`Active status for ${user.name}`}
                    onCheckedChange={(checked) => handleActiveChange(user.id, checked)}
                  />
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
