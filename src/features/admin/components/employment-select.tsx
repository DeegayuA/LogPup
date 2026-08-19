'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EMPLOYMENT_TYPES, hasCappablePower, type EmploymentType, type UserRole } from '@/features/auth/capabilities'

/**
 * Where somebody is in their employment — NOT their seat.
 *
 * Separate control on purpose: a trainee can be an editor, an intern can be a
 * member, a contractor can be a manager. This caps what the seat may sign off
 * and never grants, so the two questions stay legible as two questions.
 */
const LABELS: Record<EmploymentType, { label: string; hint: string }> = {
  permanent: { label: 'Permanent', hint: 'No restrictions beyond their seat' },
  probation: { label: 'Probation', hint: 'Cannot do the irreversible things' },
  trainee: { label: 'Trainee', hint: 'Cannot approve or sign off anything' },
  intern: { label: 'Intern', hint: 'Cannot approve or sign off anything' },
  contract: { label: 'Contract', hint: 'Cannot admit people to the org' },
}

export function EmploymentSelect({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className,
}: {
  value: EmploymentType
  onChange: (value: EmploymentType) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next as EmploymentType)}
    >
      <SelectTrigger size="sm" aria-label={ariaLabel} className={className}>
        <SelectValue>{(v: string) => LABELS[v as EmploymentType]?.label ?? v}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {EMPLOYMENT_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            <span className="flex flex-col gap-0.5">
              <span>{LABELS[type].label}</span>
              <span className="text-2xs text-muted-foreground">{LABELS[type].hint}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Shown beside a seat whose powers the employment stage is actually reducing,
 * so a missing control is explained where it is missing rather than being a
 * mystery.
 */
export function CapNotice({
  employmentType,
  role,
}: {
  employmentType: EmploymentType
  role: UserRole
}) {
  if (employmentType === 'permanent') return null
  // Asks the matrix, never a role list: an inline
  // `role === 'admin' || role === 'manager'` is the same drift bug the
  // predicate exists to prevent, just with more values in it.
  if (!hasCappablePower(role)) return null

  const what =
    employmentType === 'probation'
      ? 'cannot purge, grant roles or offboard'
      : employmentType === 'contract'
        ? 'cannot create or approve accounts'
        : 'cannot approve anything'

  return (
    <span className="text-2xs text-warning">
      {LABELS[employmentType].label}: {what}
    </span>
  )
}
