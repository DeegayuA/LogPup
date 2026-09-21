'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { SearchSelect, type SearchSelectOption } from '@/components/ui/search-select'
import { JOB_ROLE_GROUPS, JOB_ROLE_MAX_LENGTH, JOB_ROLES } from '@/lib/job-roles'

const CUSTOM_JOB_ROLE = '__custom__'
const NO_JOB_ROLE = '__none__'

// Searchable Select (curated options from src/lib/job-roles.ts) + an inline
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
  allowAllRoles = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  ariaLabel?: string
  size?: 'sm' | 'default'
  allowAllRoles?: boolean
}) {
  const isCurated =
    (allowAllRoles && value === 'All roles') || (value !== '' && JOB_ROLES.includes(value))
  const [showCustomInput, setShowCustomInput] = useState(Boolean(value) && !isCurated)
  const [customDraft, setCustomDraft] = useState(!isCurated ? value : '')

  const options: SearchSelectOption[] = useMemo(() => {
    const list: SearchSelectOption[] = [
      { value: NO_JOB_ROLE, label: '— None (clear) —', hint: 'No job role' },
    ]

    if (allowAllRoles) {
      list.push({
        value: 'All roles',
        label: 'All roles (default rate)',
        hint: 'Organization default',
      })
    }

    for (const group of JOB_ROLE_GROUPS) {
      for (const role of group.roles) {
        list.push({
          value: role,
          label: role,
          hint: group.label,
        })
      }
    }

    list.push({
      value: CUSTOM_JOB_ROLE,
      label: 'Other…',
      hint: 'Type a custom title',
    })

    if (!isCurated && value && !list.some((o) => o.value === value)) {
      list.push({
        value,
        label: value,
        hint: 'Custom role',
      })
    }

    return list
  }, [allowAllRoles, isCurated, value])

  const selectValue = !value
    ? NO_JOB_ROLE
    : isCurated
      ? value
      : options.some((o) => o.value === value)
        ? value
        : CUSTOM_JOB_ROLE

  function handleSelectChange(next: string) {
    if (next === CUSTOM_JOB_ROLE) {
      setShowCustomInput(true)
      return
    }
    setShowCustomInput(false)
    onChange(next === NO_JOB_ROLE ? '' : next)
  }

  function commitCustom() {
    const trimmed = customDraft.trim()
    if (trimmed && trimmed !== value) onChange(trimmed)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <SearchSelect
        id={id}
        value={selectValue}
        onValueChange={handleSelectChange}
        options={options}
        placeholder="Select a job role…"
        searchPlaceholder="Type to search roles…"
        emptyText="No role matches that."
        size={size}
        disabled={disabled}
        aria-label={ariaLabel}
      />
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
