'use client'

import * as React from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { selectTriggerClassName } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * A select you can type into.
 *
 * Base UI's Select has no filtering, which is fine for a seat picker with seven
 * fixed options and wrong for anything drawn from a table: a studio with thirty
 * apps turns "pick an app" into scrolling a list to find a name the person
 * already knows. This is the standard combobox composition — a Popover holding
 * a cmdk list — so it inherits the same matching behaviour the ⌘K palette
 * already teaches people.
 *
 * It deliberately LOOKS like a Select rather than announcing itself as a new
 * control: same trigger class, imported from select.tsx rather than copied, so
 * the two cannot drift into slightly different heights inside one form.
 */

export type SearchSelectOption = {
  value: string
  /** What the person reads AND what typing matches against. */
  label: string
  /** Optional second line — matched on too, so "pm" can find a lead's app. */
  hint?: string
  disabled?: boolean
}

export function SearchSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'Nothing matches that.',
  id,
  ref,
  disabled = false,
  size = 'default',
  className,
  contentClassName,
  'aria-required': ariaRequired,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: {
  value: string
  onValueChange: (value: string) => void
  options: SearchSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  id?: string
  /**
   * Forwarded to the TRIGGER, not the popup. Forms in this repo move focus to
   * the control that failed validation (see the assign form in
   * capacity-heat-editable.tsx), and a ref pointing at a popup that is closed
   * at the moment of the error would focus nothing at all.
   */
  ref?: React.Ref<HTMLButtonElement>
  disabled?: boolean
  size?: 'sm' | 'default'
  className?: string
  contentClassName?: string
  'aria-required'?: boolean | 'true' | 'false'
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = React.useState(false)
  // The combobox role REQUIRES aria-controls pointing at its popup, and the
  // popup only exists while open. A stable id generated here is referenced by
  // both, which is what the APG pattern expects — a collapsed combobox is
  // allowed to name a listbox that is not currently rendered.
  const listId = React.useId()
  const selected = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            id={id}
            ref={ref}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-required={ariaRequired}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            aria-label={ariaLabel}
            disabled={disabled}
            data-size={size}
            data-placeholder={selected ? undefined : ''}
            className={cn(selectTriggerClassName, 'w-full', className)}
          />
        }
      >
        <span className="line-clamp-1 text-left">{selected?.label ?? placeholder}</span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn('w-(--anchor-width) min-w-56 p-0', contentClassName)}
      >
        <Command
          /**
           * cmdk filters on each item's `value`, and ours are database ids. Left
           * alone, typing an app's NAME would match nothing — the one thing a
           * searchable select exists to do. Filtering explicitly against the
           * label and hint keeps the id as the value the form submits while the
           * words the person can see are the words that match.
           */
          filter={(itemValue, search) => {
            const option = options.find((candidate) => candidate.value === itemValue)
            if (!option) return 0
            const haystack = `${option.label} ${option.hint ?? ''}`.toLowerCase()
            return haystack.includes(search.trim().toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList id={listId}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  data-checked={option.value === value}
                  onSelect={(next) => {
                    onValueChange(next)
                    setOpen(false)
                  }}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate">{option.label}</span>
                    {option.hint ? (
                      <span className="truncate text-2xs text-muted-foreground">
                        {option.hint}
                      </span>
                    ) : null}
                  </span>
                  {/* The selected row is marked for sighted users by the check
                      and for assistive tech by aria-selected, which cmdk sets
                      from the active descendant — those are different states
                      and both are needed. */}
                  <CheckIcon
                    aria-hidden
                    className={cn(
                      'ml-auto size-4 shrink-0',
                      option.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
