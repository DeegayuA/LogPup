'use client'

import Link from 'next/link'
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
  setUserActive,
  setUserOrgTags,
  setUserPersonalEmail,
  setUserPhone,
  setUserEmploymentType,
  setUserRole,
  setUserTitle,
} from '@/features/admin/actions'
import { PERSONAL_EMAIL_MAX_LENGTH } from '@/features/auth/personal-email-schema'
import { Input } from '@/components/ui/input'
import { OrgTagsField } from '@/features/admin/components/org-tags-field'
import type { AdminUser } from '@/features/admin/queries'
import { orgForEmail } from '@/lib/org-from-domain'
import { JobRoleSelect } from '@/components/shared/job-role-select'
import { SeatSelect } from '@/features/admin/components/seat-select'
import { CapNotice, EmploymentSelect } from '@/features/admin/components/employment-select'
import type { EmploymentType, UserRole } from '@/features/auth/capabilities'

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

  function handleRoleChange(userId: string, role: UserRole) {
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

  // One row's controls, rendered by BOTH layouts so the two can never drift
  // apart into two different sets of affordances.
  function seatControl(user: AdminUser, isSelf: boolean) {
    return (
      <div title={isSelf ? SELF_TITLE : undefined} className="inline-block">
        <SeatSelect
          value={user.role}
          disabled={isSelf || isPending}
          ariaLabel={`Seat for ${user.name}`}
          onChange={(role) => handleRoleChange(user.id, role)}
          className="w-full min-w-40"
        />
      </div>
    )
  }

  function handleEmploymentChange(user: AdminUser, employmentType: EmploymentType) {
    startTransition(async () => {
      try {
        const res = await setUserEmploymentType({
          userId: user.id,
          employmentType,
          supervisorId: user.supervisorId,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Employment updated')
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  function employmentControl(user: AdminUser, isSelf: boolean) {
    return (
      <div className="flex flex-col gap-1">
        <div title={isSelf ? SELF_TITLE : undefined} className="inline-block">
          <EmploymentSelect
            value={user.employmentType}
            disabled={isSelf || isPending}
            ariaLabel={`Employment for ${user.name}`}
            onChange={(type) => handleEmploymentChange(user, type)}
            className="w-full min-w-36"
          />
        </div>
        {/* Explained where the control is missing, rather than leaving an
            admin wondering why a manager has no approve button. */}
        <CapNotice employmentType={user.employmentType} role={user.role} />
      </div>
    )
  }

  function handoverLink(user: AdminUser, isSelf: boolean) {
    if (isSelf) return null
    return (
      <Link
        href={`/admin/people/${user.id}/handover`}
        className="text-2xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Hand over work
      </Link>
    )
  }

  function activeControl(user: AdminUser, isSelf: boolean) {
    return (
      <div title={isSelf ? SELF_TITLE : undefined} className="inline-block">
        <Switch
          checked={user.active}
          disabled={isSelf || isPending}
          aria-label={`Active status for ${user.name}`}
          onCheckedChange={(checked) => handleActiveChange(user.id, checked)}
        />
      </div>
    )
  }

  function identity(user: AdminUser) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Avatar size="sm">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{user.name}</span>
            {user.mustChangePassword ? (
              <Badge
                variant="outline"
                title="Still on the starter password — they must change it on first sign-in"
              >
                starter password
              </Badge>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody here yet. Add a teammate by email to get started.
      </p>
    )
  }

  return (
    <>
      {/* MOBILE: one card per person. A seven-column table on a phone is a
          horizontal scroll nobody discovers, so the same fields stack instead
          of shrinking to unreadable. */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          return (
            <li key={user.id} className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                {identity(user)}
                <div className="flex flex-col items-end gap-1">
                  {activeControl(user, isSelf)}
                  {handoverLink(user, isSelf)}
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Seat">{seatControl(user, isSelf)}</Field>
                <Field label="Employment">{employmentControl(user, isSelf)}</Field>
                <Field label="Job role">
                  <JobRoleCell user={user} />
                </Field>
                <Field label="Phone">
                  <PhoneCell user={user} />
                </Field>
                <Field label="Personal email">
                  <PersonalEmailCell user={user} />
                </Field>
                <Field label="Organizations" wide>
                  <OrgTagsCell user={user} suggestions={allOrgTags} />
                </Field>
              </dl>
            </li>
          )
        })}
      </ul>

      {/* DESKTOP: the table, in its own scroll container so wide content
          scrolls here rather than pushing the whole page sideways. */}
      <div className="hidden overflow-x-auto lg:block">
        <Table className="min-w-[74rem]">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead>Employment</TableHead>
              <TableHead>Job role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Personal email</TableHead>
              <TableHead>Organizations</TableHead>
              <TableHead className="text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              return (
                <TableRow key={user.id}>
                  <TableCell className="max-w-64">{identity(user)}</TableCell>
                  <TableCell>{seatControl(user, isSelf)}</TableCell>
                  <TableCell>{employmentControl(user, isSelf)}</TableCell>
                  <TableCell className="min-w-48">
                    <JobRoleCell user={user} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <PhoneCell user={user} />
                  </TableCell>
                  <TableCell className="max-w-56">
                    <PersonalEmailCell user={user} />
                  </TableCell>
                  <TableCell className="min-w-44">
                    <OrgTagsCell user={user} suggestions={allOrgTags} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      {activeControl(user, isSelf)}
                      {handoverLink(user, isSelf)}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function Field({
  label,
  children,
  wide,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'flex flex-col gap-1 sm:col-span-2' : 'flex flex-col gap-1'}>
      <dt className="text-2xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
