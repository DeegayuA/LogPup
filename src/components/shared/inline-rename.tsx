'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

/**
 * Double-click or `F2` turns `value` into an input; `Enter` (or blur) saves,
 * `Esc` cancels back to the last-saved text. `onSave` is expected to be
 * optimistic on the caller's side (a `useOptimistic` + toast-on-failure
 * pattern, same as every other mutation in this app) — this component only
 * owns the "am I editing right now" state, not the save's success/failure.
 *
 * Not draggable-listener-aware by design: callers that mount this inside a
 * draggable surface (a task card, a roadmap label cell) are responsible for
 * keeping the rename trigger (the text itself, here) outside whatever
 * element carries dnd-kit's pointer listeners, the same way the roadmap's
 * label cell keeps its Link separate from the bar's drag surface.
 */
export function InlineRename({
  value,
  onSave,
  disabled,
  className,
  inputClassName,
  ariaLabel,
  maxLength = 140,
}: {
  value: string
  onSave: (next: string) => void
  disabled?: boolean
  className?: string
  inputClassName?: string
  ariaLabel?: string
  maxLength?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Enter edit mode with the current value, every time — not just on mount —
  // so re-opening after an external update (e.g. another admin's rename
  // landing via revalidation) edits the fresh text, not a stale draft.
  function startEditing() {
    if (disabled) return
    setDraft(value)
    setEditing(true)
  }

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== value) onSave(next)
  }

  function cancel() {
    setEditing(false)
    setDraft(value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
    // Stop propagation for every key: this input very often lives inside a
    // draggable/sortable node (dnd-kit's KeyboardSensor listens for Space on
    // the whole card), and typing a space while renaming must never lift it.
    event.stopPropagation()
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        maxLength={maxLength}
        aria-label={ariaLabel}
        autoFocus
        className={cn(
          'w-full rounded-sm border border-input bg-background px-1 py-0.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
          inputClassName,
        )}
      />
    )
  }

  return (
    <span
      // Its own tab stop (when enabled) so F2 is reachable without relying
      // on some ancestor already having focus — deliberate, since every
      // caller here nests this next to (not inside) whatever navigational
      // element it sits beside, precisely to avoid the conflict a rename
      // trigger layered on top of a link's own click target would create.
      tabIndex={disabled ? undefined : 0}
      onDoubleClick={(e) => {
        if (disabled) return
        e.stopPropagation()
        startEditing()
      }}
      onKeyDown={(e) => {
        if (e.key === 'F2') {
          e.preventDefault()
          e.stopPropagation()
          startEditing()
        }
      }}
      title={disabled ? undefined : 'Double-click or press F2 to rename'}
      className={cn(
        !disabled && 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      {value}
    </span>
  )
}
