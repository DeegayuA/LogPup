'use client'

import { cn } from '@/lib/utils'
import type { HeaderState } from '@/features/admin/bulk-logic'

/**
 * Real `<input type="checkbox">`, not a styled div — the same choice the
 * sprint board's task card made and for the same reason: it is reachable by
 * Tab, toggles on Space, and announces its own name and state without a line
 * of ARIA. `accent-primary` is all the theming a checkbox needs.
 */
export function RowCheckbox({
  checked,
  label,
  onToggle,
  className,
}: {
  checked: boolean
  label: string
  /**
   * `range` is true when the pointer click carried Shift, so the caller can
   * extend from its anchor. Keyboard activation never sets it — Space fires a
   * change with no modifier, which is exactly the plain toggle it should be.
   */
  onToggle: (range: boolean) => void
  className?: string
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={() => {}}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(event.shiftKey)
      }}
      className={cn(
        'size-4 shrink-0 cursor-pointer accent-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
        className,
      )}
    />
  )
}

/**
 * The select-all box. `indeterminate` is a DOM property with no HTML
 * attribute, so it can only be set through the element itself — hence the
 * callback ref rather than a prop.
 */
export function HeaderCheckbox({
  state,
  label,
  onToggle,
}: {
  state: HeaderState
  label: string
  onToggle: () => void
}) {
  return (
    <input
      type="checkbox"
      checked={state === 'all'}
      ref={(el) => {
        if (el) el.indeterminate = state === 'partial'
      }}
      aria-label={label}
      onChange={onToggle}
      className="size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
    />
  )
}
