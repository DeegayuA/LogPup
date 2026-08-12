'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  setUserActive,
  setUserOrgTags,
  setUserPersonalEmail,
  setUserPhone,
  setUserRole,
  setUserTitle,
} from '@/features/admin/actions'
import { PERSONAL_EMAIL_MAX_LENGTH } from '@/features/auth/personal-email-schema'
import { Input } from '@/components/ui/input'
import { OrgTagsField } from '@/features/admin/components/org-tags-field'
import type { AdminUser } from '@/features/admin/queries'
import { orgForEmail } from '@/lib/org-from-domain'
import { JobRoleSelect } from '@/components/shared/job-role-select'

const SELF_TITLE = 'Cannot change your own account'

// One user's "Job role" (users.title) — display/organizational metadata
// only, separate from the admin|member permission enum, which this feature
// does not touch. Uses the shared grouped select (src/lib/job-roles.ts) so
// the curated list matches the add-user dialog; saves on every change.
function JobRoleCell({ user }: { user: AdminUser }) {
  const [isPending, startTransition] = useTransition()

  function save(title: string) {
    startTransition(async () => {
      try {
        const res = await setUserTitle(user.id, title)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <JobRoleSelect
      value={user.title ?? ''}
      onChange={save}
      disabled={isPending}
      ariaLabel={`Job role for ${user.name}`}
      size="sm"
    />
  )
}

// One user's contact number, saved on blur or Enter (Escape reverts). Blank
// clears it. Prop-driven like the other cells: the refreshed server value
// flows back down, so nothing drifts if two admins edit at once.
function PhoneCell({ user }: { user: AdminUser }) {
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(user.phone ?? '')

  function save() {
    const next = draft.trim()
    if (next === (user.phone ?? '')) return
    startTransition(async () => {
      try {
        const res = await setUserPhone(user.id, next)
        if (!res.ok) {
          toast.error(res.error)
          setDraft(user.phone ?? '')
          return
        }
      } catch {
        toast.error('Something went wrong. Please try again.')
        setDraft(user.phone ?? '')
      }
    })
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') setDraft(user.phone ?? '')
      }}
      disabled={isPending}
      placeholder="—"
      maxLength={30}
      aria-label={`Phone number for ${user.name}`}
      className="h-8 w-36 font-mono text-xs"
    />
  )
}

// One user's second, contact-only address. Same save-on-blur/Enter,
// revert-on-Escape shape as PhoneCell above — and, like it, prop-driven so
// the refreshed server value wins if two admins edit at once.
//
// This is NOT the sign-in email (that one lives in the User column and is
// deliberately not editable here): setUserPersonalEmail only ever writes
// users.personal_email.
function PersonalEmailCell({ user }: { user: AdminUser }) {
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(user.personalEmail ?? '')

  function save() {
    const next = draft.trim()
    if (next === (user.personalEmail ?? '')) return
    startTransition(async () => {
      try {
        const res = await setUserPersonalEmail(user.id, next)
        if (!res.ok) {
          toast.error(res.error)
          setDraft(user.personalEmail ?? '')
          return
        }
      } catch {
        toast.error('Something went wrong. Please try again.')
        setDraft(user.personalEmail ?? '')
      }
    })
  }

  return (
    <Input
      type="email"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') setDraft(user.personalEmail ?? '')
      }}
      disabled={isPending}
      placeholder="—"
      maxLength={PERSONAL_EMAIL_MAX_LENGTH}
      aria-label={`Personal email for ${user.name}`}
      className="h-8 w-52 text-xs"
    />
  )
}

// Chips + a popover editor for one user's organization tags. Prop-driven:
// each add/remove saves immediately via setUserOrgTags, and the refreshed
// server data flows back down — no local copy to drift out of sync.
function OrgTagsCell({ user, suggestions }: { user: AdminUser; suggestions: string[] }) {
  const [isPending, startTransition] = useTransition()

  function handleTagsChange(next: string[]) {
    startTransition(async () => {
      try {
        const res = await setUserOrgTags(user.id, next)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
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
          <TableHead>Phone</TableHead>
          <TableHead>Personal email</TableHead>
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
                <PhoneCell user={user} />
              </TableCell>
              <TableCell>
                <PersonalEmailCell user={user} />
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
