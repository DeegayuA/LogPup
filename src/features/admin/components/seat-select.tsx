'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROLE_LABELS, type UserRole } from '@/features/auth/capabilities'

/**
 * The access seat — what a person may DO. Deliberately separate from their job
 * role (users.title), which is what they ARE. A QA Engineer can hold any seat;
 * a Project Manager is not automatically a manager seat.
 *
 * Grouped by the kind of reach each reach has rather than listed flat, because
 * seven flat options force the reader to remember which are dangerous. The
 * one-line description under each is the difference between an admin picking
 * correctly and picking the first plausible word.
 */
const SEAT_GROUPS: { label: string; seats: { value: UserRole; hint: string }[] }[] = [
  {
    label: 'Workspace-wide',
    seats: [
      { value: 'superadmin', hint: 'Everything, including destructive operations' },
      { value: 'admin', hint: 'Org operations — no danger zone, cannot grant superadmin' },
    ],
  },
  {
    label: 'Scoped to their projects',
    seats: [
      { value: 'manager', hint: 'Admin powers, but only where they are PM or lead' },
      { value: 'editor', hint: 'Edits in their projects; deletes need approval' },
    ],
  },
  {
    label: 'Standard',
    seats: [{ value: 'member', hint: 'Logs their own work, reads their projects' }],
  },
  {
    label: 'Read-only',
    seats: [
      { value: 'stakeholder', hint: 'Client seat — only granted projects, no people directory' },
      { value: 'auditor', hint: 'Reads everything including the audit trail, writes nothing' },
    ],
  },
]

export function SeatSelect({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  size = 'sm',
  className,
}: {
  value: UserRole
  onChange: (value: UserRole) => void
  disabled?: boolean
  ariaLabel?: string
  size?: 'sm' | 'default'
  className?: string
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next as UserRole)}
    >
      <SelectTrigger size={size} aria-label={ariaLabel} className={className}>
        {/* Function child, not a bare SelectValue: without it the trigger
            renders the raw enum value ('superadmin') instead of its label. */}
        <SelectValue>{(v: string) => ROLE_LABELS[v as UserRole] ?? v}</SelectValue>
      </SelectTrigger>
      {/* Three overrides of the shared primitive, all for the same reason: this
          is the only Select in the product whose ITEMS are two lines of prose
          rather than one short label.

          w-auto breaks the popup off `w-(--anchor-width)`. That default is right
          everywhere else — a menu the width of its trigger — but this trigger is
          size="sm" inside a table cell, so the seat descriptions were being
          clipped mid-word ("Everything, including destructiv…") with no ellipsis,
          which turns the one line that tells an admin what they are granting into
          a guess. Capped against --available-width so it can never run off a
          narrow viewport. */}
      <SelectContent className="w-auto min-w-[min(20rem,var(--available-width))] max-w-[min(26rem,var(--available-width))]">
        {SEAT_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.seats.map((seat) => (
              <SelectItem key={seat.value} value={seat.value}>
                {/* whitespace-normal because the primitive's ItemText sets
                    whitespace-nowrap for single-label selects. white-space
                    inherits, so the child wins — the hint wraps instead of
                    being cut off. items-start keeps both lines flush left
                    against the primitive's items-center. */}
                <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal py-0.5">
                  <span className="font-medium">{ROLE_LABELS[seat.value]}</span>
                  <span className="text-2xs leading-snug text-balance text-muted-foreground">
                    {seat.hint}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
