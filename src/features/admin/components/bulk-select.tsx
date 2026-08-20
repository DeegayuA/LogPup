'use client'

import { cn } from '@/lib/utils'
import type { HeaderState } from '@/features/admin/bulk-logic'

/**
 * Real `<input type="checkbox">`, not a styled div — the same choice the
 * sprint board's task card made and for the same reason: it is reachable by
 * Tab, toggles on Space, and announces its own name and state without a line
 * of ARIA. `accent-primary` is all the theming a checkbox needs.
 *
 * THE HIT AREA IS BIGGER THAN THE 16px BOX. A bare size-4 input is a
 * fingertip-sized target on the mobile card layouts, so the input sits in a
 * size-4 label whose absolutely-positioned overlay extends the clickable area
 * to ~36px without moving a pixel of layout. The click handler lives on the
 * LABEL with preventDefault — one handler for every activation path: a
 * pointer press anywhere in the halo, and keyboard Space (which fires a click
 * on the input that bubbles here) both land in the same place, and
 * preventDefault stops the label's own forwarding from double-toggling.
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
    <label
      className={cn('relative inline-flex size-4 cursor-pointer items-center justify-center', className)}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle(event.shiftKey)
      }}
    >
      <span aria-hidden className="absolute -inset-2.5" />
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={() => {}}
        className={cn(
          'size-4 shrink-0 cursor-pointer accent-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card',
        )}
      />
    </label>
  )
}

/**
 * The select-all box. `indeterminate` is a DOM property with no HTML
 * attribute, so it can only be set through the element itself — hence the
 * callback ref rather than a prop. Same extended hit area as RowCheckbox.
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
    <label
      className="relative inline-flex size-4 cursor-pointer items-center justify-center"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
    >
      <span aria-hidden className="absolute -inset-2.5" />
      <input
        type="checkbox"
        checked={state === 'all'}
        ref={(el) => {
          if (el) el.indeterminate = state === 'partial'
        }}
        aria-label={label}
        onChange={() => {}}
        className="size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
      />
    </label>
  )
}
