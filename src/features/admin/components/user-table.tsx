'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  Download,
  Pencil,
  Search,
  ShieldCheck,
  UserRoundCog,
  UserRoundX,
  UsersRound,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  removeUser,
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
import { Label } from '@/components/ui/label'
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
              size="icon-sm"
              aria-label={`Edit organizations for ${user.name}`}
              // The visible button stays small; the pseudo-element halo is
              // what a fingertip actually has to land on.
              className="relative after:absolute after:-inset-2 after:content-['']"
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

/**
 * PER-ROW TRANSITIONS, deliberately. These three cells used to share the
 * table's one useTransition, so changing one person's seat disabled every
 * select and switch in the table until the write settled — working through
 * several people serialized on each other for no reason. Each cell now owns
 * its wait; `bulkPending` still freezes them all during a batch, which really
 * does touch many rows at once.
 */
function SeatCell({
  user,
  isSelf,
  bulkPending,
}: {
  user: AdminUser
  isSelf: boolean
  bulkPending: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(role: UserRole) {
    startTransition(async () => {
      try {
        const res = await setUserRole(user.id, role)
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

  return (
    <div title={isSelf ? SELF_TITLE : undefined} className="min-w-0">
      <SeatSelect
        value={user.role}
        disabled={isSelf || isPending || bulkPending}
        ariaLabel={isSelf ? `Seat for ${user.name} (your own account — locked)` : `Seat for ${user.name}`}
        onChange={handleRoleChange}
        className="w-full"
      />
    </div>
  )
}

function EmploymentCell({
  user,
  isSelf,
  bulkPending,
}: {
  user: AdminUser
  isSelf: boolean
  bulkPending: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleEmploymentChange(employmentType: EmploymentType) {
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

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div title={isSelf ? SELF_TITLE : undefined} className="min-w-0">
        <EmploymentSelect
          value={user.employmentType}
          disabled={isSelf || isPending || bulkPending}
          ariaLabel={
            isSelf
              ? `Employment for ${user.name} (your own account — locked)`
              : `Employment for ${user.name}`
          }
          onChange={handleEmploymentChange}
          className="w-full"
        />
      </div>
      {/* Explained where the control is missing, rather than leaving an
          admin wondering why a manager has no approve button. */}
      <CapNotice employmentType={user.employmentType} role={user.role} />
    </div>
  )
}

function ActiveCell({
  user,
  isSelf,
  bulkPending,
}: {
  user: AdminUser
  isSelf: boolean
  bulkPending: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleActiveChange(active: boolean) {
    startTransition(async () => {
      try {
        const res = await setUserActive(user.id, active)
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
    <div title={isSelf ? SELF_TITLE : undefined} className="inline-block">
      <Switch
        checked={user.active}
        disabled={isSelf || isPending || bulkPending}
        aria-label={
          isSelf
            ? `Active status for ${user.name} (your own account — locked)`
            : `Active status for ${user.name}`
        }
        onCheckedChange={handleActiveChange}
      />
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

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const SEAT_ALL = '__all__'

/** Case-insensitive match over the fields an admin actually hunts by. */
function matchesQuery(user: AdminUser, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [user.name, user.email, user.personalEmail ?? '', user.title ?? '', user.phone ?? '', ...user.orgTags]
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

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

  // FIND before scan: the most frequent admin task is changing one field on
  // one person, and at 30+ users a visual scan was the whole cost. The search
  // covers the disclosure-hidden fields too (job role, phone, personal email,
  // org tags), so "who has the QA tag" is typeable. Status + seat narrow to a
  // working set — filter to Inactive, select all, bulk-activate is now three
  // interactions.
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [seatFilter, setSeatFilter] = useState<string>(SEAT_ALL)

  const allIds = useMemo(() => users.map((user) => user.id), [users])

  const visible = useMemo(
    () =>
      users.filter(
        (user) =>
          matchesQuery(user, query) &&
          (statusFilter === 'all' || (statusFilter === 'active') === user.active) &&
          (seatFilter === SEAT_ALL || user.role === seatFilter),
      ),
    [users, query, statusFilter, seatFilter],
  )
  const visibleIds = useMemo(() => visible.map((user) => user.id), [visible])
  const anyFilter = query.trim() !== '' || statusFilter !== 'all' || seatFilter !== SEAT_ALL

  // Derived rather than stored, so a revalidation that drops a row can never
  // leave the bar counting somebody who is no longer in the table. Pruned
  // against ALL ids, not the visible ones — clearing a filter must not eat a
  // selection made under it.
  const selected = useMemo(() => pruneSelection(picked, allIds), [picked, allIds])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  // Every tag already on any user, offered as one-click suggestions when
  // editing another user's organizations.
  const allOrgTags = useMemo(
    () =>
      Array.from(new Set(users.flatMap((u) => u.orgTags))).sort((a, b) => a.localeCompare(b)),
    [users],
  )

  const seatItems = useMemo(
    () => [
      { value: SEAT_ALL, label: 'Any seat' },
      ...(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([value, label]) => ({
        value: value as string,
        label,
      })),
    ],
    [],
  )

  function toggleRow(id: string, range: boolean) {
    setPicked((current) =>
      range && anchorId
        ? selectRange(pruneSelection(current, allIds), visibleIds, anchorId, id)
        : toggleSelected(pruneSelection(current, allIds), id),
    )
    setAnchorId(id)
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

  function identity(user: AdminUser, isSelf: boolean) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Avatar size="sm">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <span className="truncate">{user.name}</span>
            {/* The visible WHY behind this row's disabled controls — a title
                attribute alone is invisible to touch and unreliable for screen
                readers. */}
            {isSelf ? <Badge variant="outline">you</Badge> : null}
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
            <dd className="min-w-0 max-w-sm">
              <EmploymentCell user={user} isSelf={isSelf} bulkPending={isPending} />
            </dd>
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
              Hand the work over first — removing somebody does not reassign it.
            </span>
          </div>
          {isSelf ? (
            <span className="text-2xs text-muted-foreground">Not available for your own account</span>
          ) : (
            /* Handover then removal, in the order they should happen. Removal
               is the destructive one, so it is last and styled as such — and
               both sit a step away from the seat and status controls above,
               which are what an admin actually comes here to change. */
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" render={<Link href={`/admin/people/${user.id}/handover`} />}>
                <UserRoundCog aria-hidden className="size-3.5" />
                Hand over work
              </Button>
              <RemovePersonButton user={user} disabled={isPending} />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Nobody here yet."
        description="Approved teammates appear in this table. Add one by email with the button above — they get a starter password to change on first sign-in."
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* The find row. Client state, not URL — an admin table's working set is
          a moment's question, not evidence anyone pastes into a review. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, role, tag…"
            aria-label="Search people"
            className="h-8 w-full pl-7 text-xs"
          />
        </div>
        <Select
          value={statusFilter}
          items={STATUS_ITEMS}
          onValueChange={(value) => setStatusFilter((value as StatusFilter) || 'all')}
        >
          <SelectTrigger size="sm" className="w-full sm:w-32" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={seatFilter}
          items={seatItems}
          onValueChange={(value) => setSeatFilter(String(value ?? SEAT_ALL))}
        >
          <SelectTrigger size="sm" className="w-full sm:w-36" aria-label="Filter by seat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seatItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p role="status" className="font-mono text-2xs tabular-nums text-muted-foreground sm:ml-auto">
          {anyFilter ? `${visible.length} of ${users.length}` : `${users.length} ${users.length === 1 ? 'person' : 'people'}`}
        </p>
      </div>

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

          <AlertDialog
            onOpenChange={(open) => {
              // The "deactivate even with open work" acknowledgment is consent
              // for ONE run. Without this reset, reopening the dialog showed
              // the destructive override pre-ticked from last time.
              if (!open) setAckUntransferred(false)
            }}
          >
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

        {visible.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nobody matches these filters."
            description="No approved teammate answers the search and filters at once."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery('')
                  setStatusFilter('all')
                  setSeatFilter(SEAT_ALL)
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* PHONE: one card per person. Nine fields in a row on a phone is a
                horizontal scroll nobody discovers, so they stack instead of
                shrinking to unreadable. */}
            <ul className="flex flex-col gap-3 md:hidden">
              {visible.map((user) => {
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
                        {identity(user, isSelf)}
                      </div>
                      <ActiveCell user={user} isSelf={isSelf} bulkPending={isPending} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-2xs text-muted-foreground">Seat</span>
                      <SeatCell user={user} isSelf={isSelf} bulkPending={isPending} />
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
                        state={headerSelectionState(selected, visibleIds)}
                        label="Select all people shown"
                        onToggle={() =>
                          setPicked((current) =>
                            toggleAllSelected(pruneSelection(current, allIds), visibleIds),
                          )
                        }
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
                  {visible.map((user) => {
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
                        <TableCell className="align-top">{identity(user, isSelf)}</TableCell>
                        <TableCell className="align-top">
                          <SeatCell user={user} isSelf={isSelf} bulkPending={isPending} />
                        </TableCell>
                        <TableCell className="hidden align-top lg:table-cell">
                          <EmploymentCell user={user} isSelf={isSelf} bulkPending={isPending} />
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <ActiveCell user={user} isSelf={isSelf} bulkPending={isPending} />
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
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Removing somebody from the workspace.
 *
 * REMOVAL IS NOT DEACTIVATION, and the dialog says which is which, because
 * the Active switch is three inches away and the two are easy to confuse: a
 * deactivated person still signs in and is told their account is off; a
 * removed one cannot sign in at all and stops being offered as an assignee,
 * attendee, lead or PM anywhere.
 *
 * The reason field is optional and free text. It is the only part of a
 * removal anybody reads six months later — "contract ended" versus "duplicate
 * account" is the difference between a restore that makes sense and one
 * nobody can justify — so it is offered, never demanded.
 *
 * Their work is deliberately untouched, and the dialog promises that plainly:
 * removal opens an interval in user_deletions and nothing else, so every
 * comment, worklog and meeting keeps their name on it (see the table's
 * comment in src/db/schema.ts).
 */
function RemovePersonButton({ user, disabled }: { user: AdminUser; disabled: boolean }) {
  const [reason, setReason] = useState('')
  const [pending, startRemoving] = useTransition()

  function handleRemove() {
    startRemoving(async () => {
      try {
        const res = await removeUser(user.id, reason.trim() || undefined)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`${user.name} removed from the workspace`)
        setReason('')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || pending}
            className="border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
          />
        }
      >
        <UserRoundX aria-hidden className="size-3.5" />
        Remove
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {user.name} from the workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            They will not be able to sign in, and they stop appearing as an assignee,
            attendee, lead or PM. Everything they have written stays exactly where it is,
            with their name on it. An admin can restore them from Trash.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`remove-reason-${user.id}`} className="text-xs">
            Reason (optional)
          </Label>
          <Input
            id={`remove-reason-${user.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contract ended"
            maxLength={200}
            className="h-9 text-sm"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={handleRemove}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
