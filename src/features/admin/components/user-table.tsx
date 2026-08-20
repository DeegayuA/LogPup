'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Download, Pencil, ShieldCheck, UserRoundCog } from 'lucide-react'
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
import {
  bulkSetUserActive,
  bulkSetUserEmploymentType,
  bulkSetUserRole,
} from '@/features/admin/bulk-actions'
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
import { PERSONAL_EMAIL_MAX_LENGTH } from '@/features/auth/personal-email-schema'
import { Input } from '@/components/ui/input'
import { OrgTagsField } from '@/features/admin/components/org-tags-field'
import type { AdminUser } from '@/features/admin/queries'
import { orgForEmail } from '@/lib/org-from-domain'
import { JobRoleSelect } from '@/components/shared/job-role-select'
import { SeatSelect } from '@/features/admin/components/seat-select'
import { CapNotice, EmploymentSelect } from '@/features/admin/components/employment-select'
import { ROLE_LABELS, type EmploymentType, type UserRole } from '@/features/auth/capabilities'

const SELF_TITLE = 'Cannot change your own account'
const PEOPLE = { one: 'person', many: 'people' }

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
      // A placeholder that says what the field takes, not an em dash. "—"
      // reads as a value the field already holds, so an unset phone looked
      // filled in with nothing rather than simply not set yet.
      placeholder="Add a phone number"
      maxLength={30}
      aria-label={`Phone number for ${user.name}`}
      className="h-8 w-full font-mono text-xs"
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
      placeholder="Add a personal email"
      maxLength={PERSONAL_EMAIL_MAX_LENGTH}
      aria-label={`Personal email for ${user.name}`}
      className="h-8 w-full text-xs"
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
      <div className="flex min-w-0 flex-wrap gap-1">
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

const CSV_HEADERS = [
  'Name',
  'Email',
  'Seat',
  'Employment',
  'Job role',
  'Phone',
  'Personal email',
  'Organizations',
  'Active',
] as const

export function UserTable({
  users,
  currentUserId,
}: {
  users: AdminUser[]
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [picked, setPicked] = useState<string[]>([])
  const [anchorId, setAnchorId] = useState<string | null>(null)
  // ONE row open at a time, not a set. Every open row adds a six-field form to
  // the page, so leaving several open turned the directory into a column of
  // forms with the person's name lost somewhere above each one — you could no
  // longer see who you were editing. An accordion also keeps the row you just
  // opened on screen.
  const [expanded, setExpanded] = useState<string | null>(null)
  const [seatOpen, setSeatOpen] = useState(false)
  const [draftSeat, setDraftSeat] = useState<UserRole>('member')
  const [employmentOpen, setEmploymentOpen] = useState(false)
  const [draftEmployment, setDraftEmployment] = useState<EmploymentType>('permanent')
  const [ackUntransferred, setAckUntransferred] = useState(false)

  const ids = useMemo(() => users.map((user) => user.id), [users])

  // Derived rather than stored, so a revalidation that drops a row can never
  // leave the bar counting somebody who is no longer in the table.
  const selected = useMemo(() => pruneSelection(picked, ids), [picked, ids])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  // Every tag already on any user, offered as one-click suggestions when
  // editing another user's organizations.
  const allOrgTags = useMemo(
    () =>
      Array.from(new Set(users.flatMap((u) => u.orgTags))).sort((a, b) => a.localeCompare(b)),
    [users],
  )

  function toggleRow(id: string, range: boolean) {
    setPicked((current) =>
      range && anchorId
        ? selectRange(pruneSelection(current, ids), ids, anchorId, id)
        : toggleSelected(pruneSelection(current, ids), id),
    )
    setAnchorId(id)
  }

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

  function runBulk(
    run: () => Promise<Awaited<ReturnType<typeof bulkSetUserRole>>>,
    doneVerb: string,
  ) {
    startTransition(async () => {
      try {
        const res = await run()
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toastBulkResult(res.data, doneVerb, PEOPLE)
        // Left selected on purpose: the rows the guards refused — your own
        // account, the last superadmin, anyone still holding open work — are
        // the ones worth still having in hand after the toast.
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  function exportSelected() {
    const rows = users
      .filter((user) => selectedSet.has(user.id))
      .map((user) => [
        user.name,
        user.email,
        ROLE_LABELS[user.role],
        user.employmentType,
        user.title,
        user.phone,
        user.personalEmail,
        user.orgTags.join(' | '),
        user.active ? 'active' : 'inactive',
      ])
    downloadCsv('people', CSV_HEADERS, rows)
  }

  // One row's controls, rendered by BOTH layouts so the two can never drift
  // apart into two different sets of affordances.
  function seatControl(user: AdminUser, isSelf: boolean) {
    return (
      <div title={isSelf ? SELF_TITLE : undefined} className="min-w-0">
        <SeatSelect
          value={user.role}
          disabled={isSelf || isPending}
          ariaLabel={`Seat for ${user.name}`}
          onChange={(role) => handleRoleChange(user.id, role)}
          className="w-full"
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
      <div className="flex min-w-0 flex-col gap-1">
        <div title={isSelf ? SELF_TITLE : undefined} className="min-w-0">
          <EmploymentSelect
            value={user.employmentType}
            disabled={isSelf || isPending}
            ariaLabel={`Employment for ${user.name}`}
            onChange={(type) => handleEmploymentChange(user, type)}
            className="w-full"
          />
        </div>
        {/* Explained where the control is missing, rather than leaving an
            admin wondering why a manager has no approve button. */}
        <CapNotice employmentType={user.employmentType} role={user.role} />
      </div>
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
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <span className="truncate">{user.name}</span>
            {user.mustChangePassword ? (
              <Badge
                variant="outline"
                title="Still on the starter password — they must change it on first sign-in"
              >
                starter
              </Badge>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </div>
      </div>
    )
  }

  /**
   * The fields that used to be four more always-visible columns. They are the
   * ones an admin edits occasionally, not the ones they scan — so they live
   * behind a per-row disclosure, which is what lets the table fit without a
   * sideways scroll instead of being clipped into one.
   */
  function detailFields(user: AdminUser, isSelf: boolean) {
    return (
      /* Contained and inset rather than free-floating in the row. Open, this
         panel is taller than the row that owns it, and with no border of its
         own it read as a form belonging to whichever name happened to be
         above it. The left rule ties it to the person; `bg-muted/30` says
         "detail about the row" rather than "another row". */
      <div className="rounded-lg border border-border border-l-2 border-l-primary/40 bg-muted/30 p-4">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {/* Employment has its own column from lg up; below that it belongs
              here rather than nowhere. */}
          <div className="flex flex-col gap-1.5 lg:hidden">
            <dt className="text-xs font-medium text-muted-foreground">Employment</dt>
            <dd className="min-w-0 max-w-sm">{employmentControl(user, isSelf)}</dd>
          </div>
          <Field label="Job role">
            <JobRoleCell user={user} />
          </Field>
          <Field label="Phone">
            <PhoneCell user={user} />
          </Field>
          <Field label="Personal email">
            <PersonalEmailCell user={user} />
          </Field>
          <Field label="Organizations">
            <OrgTagsCell user={user} suggestions={allOrgTags} />
          </Field>
        </dl>

        {/* Offboarding is separated by a rule and rendered as a control, not a
            sentence. Under the editable fields it read as a sixth field with a
            missing input; it is the one thing here that leaves this page. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-col">
            <span className="text-xs font-medium">Offboarding</span>
            <span className="text-2xs text-muted-foreground">
              Reassign this person&apos;s open work before they leave.
            </span>
          </div>
          {isSelf ? (
            <span className="text-2xs text-muted-foreground">Not available for your own account</span>
          ) : (
            <Button variant="outline" size="sm" render={<Link href={`/admin/people/${user.id}/handover`} />}>
              <UserRoundCog aria-hidden className="size-3.5" />
              Hand over work
            </Button>
          )}
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
    <div className="flex min-w-0 flex-col">
      <BulkBar count={selected.length} noun={PEOPLE} onClear={() => setPicked([])}>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => runBulk(() => bulkSetUserActive({ ids: selected, active: true }), 'activated')}
        >
          Activate
        </Button>

        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
            Deactivate
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {selected.length} people?</AlertDialogTitle>
              <AlertDialogDescription>
                They lose access immediately. Your own account, and the last superadmin, are
                skipped — and so is anyone still holding open work, unless you say otherwise
                below.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <input
                type="checkbox"
                checked={ackUntransferred}
                onChange={(event) => setAckUntransferred(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
              />
              <span>
                Deactivate even if they still hold open work. Their projects, roles and open
                tasks stay pinned to an account nobody can sign into.
              </span>
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={() =>
                  runBulk(
                    () =>
                      bulkSetUserActive({
                        ids: selected,
                        active: false,
                        acknowledgeUntransferred: ackUntransferred,
                      }),
                    'deactivated',
                  )
                }
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Popover open={seatOpen} onOpenChange={setSeatOpen}>
          <PopoverTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
            <ShieldCheck aria-hidden className="size-3.5" />
            Seat
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <PopoverHeader>
              <PopoverTitle>Change seat</PopoverTitle>
              <PopoverDescription>
                Applies to all {selected.length} selected. Your own account and the last
                superadmin are skipped.
              </PopoverDescription>
            </PopoverHeader>
            <SeatSelect
              value={draftSeat}
              ariaLabel="New seat for the selected people"
              onChange={setDraftSeat}
              className="w-full"
            />
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                setSeatOpen(false)
                runBulk(() => bulkSetUserRole({ ids: selected, role: draftSeat }), 'moved')
              }}
            >
              Apply
            </Button>
          </PopoverContent>
        </Popover>

        <Popover open={employmentOpen} onOpenChange={setEmploymentOpen}>
          <PopoverTrigger render={<Button variant="outline" size="sm" disabled={isPending} />}>
            <UserRoundCog aria-hidden className="size-3.5" />
            Employment
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <PopoverHeader>
              <PopoverTitle>Change employment</PopoverTitle>
              <PopoverDescription>
                Existing supervisors are kept. A trainee or intern with nobody named is
                skipped rather than left unsupervised.
              </PopoverDescription>
            </PopoverHeader>
            <EmploymentSelect
              value={draftEmployment}
              ariaLabel="New employment type for the selected people"
              onChange={setDraftEmployment}
              className="w-full"
            />
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                setEmploymentOpen(false)
                runBulk(
                  () =>
                    bulkSetUserEmploymentType({
                      ids: selected,
                      employmentType: draftEmployment,
                    }),
                  'updated',
                )
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
      </BulkBar>

      {/* PHONE: one card per person. Nine fields in a row on a phone is a
          horizontal scroll nobody discovers, so they stack instead of
          shrinking to unreadable. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          return (
            <li key={user.id} className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <RowCheckbox
                    checked={selectedSet.has(user.id)}
                    label={`Select ${user.name}`}
                    onToggle={(range) => toggleRow(user.id, range)}
                    className="mt-2"
                  />
                  {identity(user)}
                </div>
                {activeControl(user, isSelf)}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xs text-muted-foreground">Seat</span>
                {seatControl(user, isSelf)}
              </div>
              {detailFields(user, isSelf)}
            </li>
          )
        })}
      </ul>

      {/* TABLET AND UP: `table-fixed` is the structural fix for the sideways
          scroll — a column no longer widens to fit a long name, so nothing can
          push the table past the viewport. The four occasional fields moved
          into the per-row disclosure below, which is what made a fixed layout
          possible without clipping anything. */}
      <div className="hidden min-w-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">
                <HeaderCheckbox
                  state={headerSelectionState(selected, ids)}
                  label="Select all people"
                  onToggle={() => setPicked((current) => toggleAllSelected(current, ids))}
                />
              </TableHead>
              <TableHead>Person</TableHead>
              <TableHead className="w-[11rem]">Seat</TableHead>
              <TableHead className="hidden w-[10rem] lg:table-cell">Employment</TableHead>
              <TableHead className="w-[4.5rem] text-right">Active</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              const isOpen = expanded === user.id
              return [
                <TableRow
                  key={user.id}
                  data-state={selectedSet.has(user.id) ? 'selected' : undefined}
                >
                  <TableCell className="align-top">
                    <RowCheckbox
                      checked={selectedSet.has(user.id)}
                      label={`Select ${user.name}`}
                      onToggle={(range) => toggleRow(user.id, range)}
                      className="mt-2"
                    />
                  </TableCell>
                  <TableCell className="align-top">{identity(user)}</TableCell>
                  <TableCell className="align-top">{seatControl(user, isSelf)}</TableCell>
                  <TableCell className="hidden align-top lg:table-cell">
                    {employmentControl(user, isSelf)}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    {activeControl(user, isSelf)}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-expanded={isOpen}
                      aria-controls={`person-detail-${user.id}`}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${user.name}`}
                      onClick={() =>
                        setExpanded((current) => (current === user.id ? null : user.id))
                      }
                    >
                      <ChevronDown
                        aria-hidden
                        className={`size-4 transition-transform duration-150 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                  </TableCell>
                </TableRow>,
                isOpen ? (
                  <TableRow key={`${user.id}-detail`} className="hover:bg-transparent">
                    <TableCell colSpan={6} className="whitespace-normal">
                      <div id={`person-detail-${user.id}`} className="px-1 pb-2">
                        {detailFields(user, isSelf)}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null,
              ]
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/**
 * One labelled field in the person detail panel.
 *
 * `max-w-sm` on the value is the point: an input stretched to the full width
 * of a two-column grid reads as a text area for a phone number, and the panel
 * looked like a form with no alignment because each control sized itself to
 * whatever cell it landed in. Labels are `text-xs`, not `text-2xs` — at 10px
 * and muted they fell under 4.5:1 in dark mode, which is where this page is
 * actually read.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 max-w-sm">{children}</dd>
    </div>
  )
}
