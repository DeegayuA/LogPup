'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { SearchSelect, type SearchSelectOption } from '@/components/ui/search-select'

export const COMMON_CURRENCIES: Array<{ code: string; name: string }> = [
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
]

const CUSTOM_CURRENCY = '__custom__'

/**
 * Searchable currency select combobox with common currencies and an "Other…" fallback
 * for typing any valid 3-letter ISO currency code.
 */
export function CurrencySelect({
  value,
  onChange,
  disabled = false,
  id,
  size = 'default',
  className,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  size?: 'sm' | 'default'
  className?: string
}) {
  const isKnown = COMMON_CURRENCIES.some((c) => c.code === value)
  const [showCustomInput, setShowCustomInput] = useState(Boolean(value) && !isKnown)
  const [customDraft, setCustomDraft] = useState(!isKnown ? value : '')

  const options: SearchSelectOption[] = useMemo(() => {
    const list: SearchSelectOption[] = COMMON_CURRENCIES.map((c) => ({
      value: c.code,
      label: c.code,
      hint: c.name,
    }))

    if (!isKnown && value && !list.some((o) => o.value === value)) {
      list.unshift({
        value,
        label: value,
        hint: 'Custom currency',
      })
    }

    list.push({
      value: CUSTOM_CURRENCY,
      label: 'Other…',
      hint: '3-letter ISO code',
    })

    return list
  }, [isKnown, value])

  function handleSelectChange(next: string) {
    if (next === CUSTOM_CURRENCY) {
      setShowCustomInput(true)
      return
    }
    setShowCustomInput(false)
    onChange(next)
  }

  function commitCustom() {
    const trimmed = customDraft.trim().toUpperCase()
    if (/^[A-Z]{3}$/.test(trimmed)) {
      onChange(trimmed)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <SearchSelect
        id={id}
        value={value}
        onValueChange={handleSelectChange}
        options={options}
        placeholder="Select currency…"
        searchPlaceholder="Type currency or name…"
        emptyText="No currency matches that."
        size={size}
        disabled={disabled}
        className={className}
        aria-label="Currency"
      />
      {showCustomInput ? (
        <Input
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value.toUpperCase())}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitCustom()
            }
          }}
          placeholder="e.g. KWD"
          maxLength={3}
          disabled={disabled}
          aria-label="Custom currency code"
          className="h-9 w-28 font-mono uppercase"
        />
      ) : null}
    </div>
  )
}
