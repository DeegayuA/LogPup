'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import { setUserActive, setUserOrgTags, setUserRole, setUserTitle } from '@/features/admin/actions'
import { OrgTagsField } from '@/features/admin/components/org-tags-field'
import type { AdminUser } from '@/features/admin/queries'
import { orgForEmail } from '@/lib/org-from-domain'

const SELF_TITLE = 'Cannot change your own account'

// Curated "Job role" options for the admin table's dedicated title column.
// This is display/organizational metadata only (users.title) — separate
// from the admin|member permission enum, which this feature does not touch.
const JOB_ROLE_OPTIONS = [
  'Developer',
  'Senior Developer',
  'Lead',
  'Frontend',
  'Backend',
  'Full-stack',
  'QA',
  'Designer',
  'DevOps',
  'PM',
  'Intern',
] as const

const OTHER_JOB_ROLE = '__other__'
const NO_JOB_ROLE = '__none__'

// Select + "Other" custom text fallback for one user's job role (users.title).
// Selecting a curated option saves immediately; selecting "Other" reveals a
// free-text input that saves on blur/Enter.
function JobRoleCell({ user }: { user: AdminUser }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isKnownTitle = Boolean(
    user.title && (JOB_ROLE_OPTIONS as readonly string[]).includes(user.title),
  )
  const [showCustomInput, setShowCustomInput] = useState(Boolean(user.title) && !isKnownTitle)
  const [customValue, setCustomValue] = useState(!isKnownTitle ? (user.title ?? '') : '')
  const selectValue = !user.title ? NO_JOB_ROLE : isKnownTitle ? user.title : OTHER_JOB_ROLE

  function save(title: string) {
    startTransition(async () => {
      try {
        const res = await setUserTitle(user.id, title)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        router.refresh()
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  function handleSelectChange(value: string) {
    if (value === OTHER_JOB_ROLE) {
      setShowCustomInput(true)
      return
    }
    setShowCustomInput(false)
    save(value === NO_JOB_ROLE ? '' : value)
  }

  function commitCustom() {
    const trimmed = customValue.trim()
    if (trimmed && trimmed !== user.title) save(trimmed)
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={selectValue}
        disabled={isPending}
        onValueChange={(value: string | null) => handleSelectChange(value ?? NO_JOB_ROLE)}
      >
        <SelectTrigger size="sm" aria-label={`Job role for ${user.name}`}>
          <SelectValue>
            {(value: string) =>
              value === NO_JOB_ROLE ? '—' : value === OTHER_JOB_ROLE ? (user.title ?? 'Other') : value
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_JOB_ROLE}>—</SelectItem>
          {JOB_ROLE_OPTIONS.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_JOB_ROLE}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {showCustomInput ? (
        <Input
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitCustom()
            }
          }}
          placeholder="Custom job role"
          maxLength={60}
          disabled={isPending}
          aria-label={`Custom job role for ${user.name}`}
          className="h-7 w-36 text-xs"
        />
      ) : null}
    </div>
  )
}

// Chips + a popover editor for one user's organization tags. Prop-driven:
// each add/remove saves immediately via setUserOrgTags, and the refreshed
// server data flows back down — no local copy to drift out of sync.
function OrgTagsCell({ user, suggestions }: { user: AdminUser; suggestions: string[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleTagsChange(next: string[]) {
    startTransition(async () => {
      try {
        const res = await setUserOrgTags(user.id, next)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        router.refresh()
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  // No org tags set by hand — offer the domain-derived guess (see
  // src/lib/org-from-domain.ts) as a muted, clearly-labeled hint rather than
  // silently leaving the cell blank.
  const derivedOrg = user.orgTags.length === 0 ? orgForEmail(user.email) : undefined

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex max-w-56 flex-wrap gap-1">
        {user.orgTags.length > 0 ? (
          user.orgTags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))
        ) : derivedOrg ? (
          <Badge
            variant="outline"
            className="text-muted-foreground"
            title="Derived from email domain"
          >
            {derivedOrg}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Edit organizations for ${user.name}`}
            />
          }
        >
          <Pencil aria-hidden className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <PopoverHeader>
            <PopoverTitle>Organizations</PopoverTitle>
            <PopoverDescription>Changes save as you add or remove.</PopoverDescription>
          </PopoverHeader>
          <OrgTagsField
            inputId={`org-tags-${user.id}`}
            tags={user.orgTags}
            onTagsChange={handleTagsChange}
            suggestions={suggestions}
            disabled={isPending}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function UserTable({
  users,
  currentUserId,
}: {
  users: AdminUser[]
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Every tag already on any user, offered as one-click suggestions when
  // editing another user's organizations.
  const allOrgTags = useMemo(
    () =>
      Array.from(new Set(users.flatMap((u) => u.orgTags))).sort((a, b) => a.localeCompare(b)),
    [users],
  )

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
          <TableHead>Job role</TableHead>
          <TableHead>Organizations</TableHead>
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
                    <span className="flex items-center gap-1.5 font-medium">
                      {user.name}
                      {user.mustChangePassword ? (
                        <Badge
                          variant="outline"
                          title="Still on the starter password — they must change it on first sign-in"
                        >
                          starter password
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <JobRoleCell user={user} />
              </TableCell>
              <TableCell>
                <OrgTagsCell user={user} suggestions={allOrgTags} />
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
