'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { JOB_ROLE_GROUPS, JOB_ROLE_MAX_LENGTH, JOB_ROLES } from '@/lib/job-roles'

const CUSTOM_JOB_ROLE = '__custom__'
const NO_JOB_ROLE = '__none__'

// Grouped Select (curated options from src/lib/job-roles.ts) + an inline
// "Other…" custom text fallback for a job role stored as free text
// (users.title). Selecting a curated option commits immediately; selecting
// "Other…" reveals a text input that commits on blur/Enter, so titles
// outside the curated list — including whatever is already saved — stay
// valid and editable.
//
// Admin-only surface: every caller (the Add-user dialog and the Users table)
// sits behind the admin guard, and the actions they call re-check it server
// side. Nothing here is the access control.
export function JobRoleSelect({
  value,
  onChange,
  disabled = false,
  id,
  ariaLabel,
  size = 'default',
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  ariaLabel?: string
  size?: 'sm' | 'default'
}) {
  const isCurated = value !== '' && JOB_ROLES.includes(value)
  const [showCustomInput, setShowCustomInput] = useState(Boolean(value) && !isCurated)
  const [customDraft, setCustomDraft] = useState(!isCurated ? value : '')
  const selectValue = !value ? NO_JOB_ROLE : isCurated ? value : CUSTOM_JOB_ROLE

  function handleSelectChange(next: string | null) {
    const resolved = next ?? NO_JOB_ROLE
    if (resolved === CUSTOM_JOB_ROLE) {
      setShowCustomInput(true)
      return
    }
    setShowCustomInput(false)
    onChange(resolved === NO_JOB_ROLE ? '' : resolved)
  }

  function commitCustom() {
    const trimmed = customDraft.trim()
    if (trimmed && trimmed !== value) onChange(trimmed)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={selectValue} disabled={disabled} onValueChange={handleSelectChange}>
        <SelectTrigger
          id={id}
          size={size}
          aria-label={ariaLabel}
          className={size === 'default' ? 'w-full' : undefined}
        >
          <SelectValue>
            {(v: string) =>
              v === NO_JOB_ROLE ? 'Select a job role' : v === CUSTOM_JOB_ROLE ? value || 'Other' : v
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_JOB_ROLE}>—</SelectItem>
          {JOB_ROLE_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectItem value={CUSTOM_JOB_ROLE}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {showCustomInput ? (
        <Input
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitCustom()
            }
          }}
          placeholder="Custom job role"
          maxLength={JOB_ROLE_MAX_LENGTH}
          disabled={disabled}
          aria-label={ariaLabel ? `Custom ${ariaLabel}` : 'Custom job role'}
          className={size === 'sm' ? 'h-7 text-xs' : 'h-9'}
        />
      ) : null}
    </div>
  )
}
