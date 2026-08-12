'use client'

/**
 * The Tech tags combobox: a chip list plus a filtered suggestion popup.
 *
 * Extracted out of app-form-dialog.tsx, where ~220 lines of ARIA combobox
 * mechanics (listbox roles, aria-activedescendant, flip-up positioning, the
 * mousedown-before-blur dance, the polite live region) were buried inside a
 * 590-line form and could be neither reused nor tested in isolation. Nothing
 * about the behaviour changed in the move — the pure matching logic it drives
 * already lives in src/lib/tech-tags.ts and has its own tests.
 */

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { canonicalizeTag, filterTagSuggestions } from '@/lib/tech-tags'

export const MAX_TECH_TAGS = 10
const TECH_TAGS_WARNING_THRESHOLD = MAX_TECH_TAGS - 2

// Rough per-option height (px) used only to guess whether the dropdown fits
// below the input before it paints — see the flip effect below. Doesn't need
// to be exact, just close enough that the flip decision doesn't flicker.
const SUGGESTION_ROW_HEIGHT = 34
const SUGGESTION_LIST_PADDING = 48

export function TechTagsInput({
  id,
  value,
  onChange,
  error,
  knownTags,
}: {
  id: string
  value: string[]
  onChange: (tags: string[]) => void
  error?: string
  /** Curated + workspace tags, merged and deduplicated (see mergeTagSources
   * in lib/tech-tags.ts). Suggestions only — never a hard constraint, so
   * typing anything not in this list still commits as free text. */
  knownTags: readonly string[]
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [dropUp, setDropUp] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const atLimit = value.length >= MAX_TECH_TAGS

  const suggestions = useMemo(
    () => filterTagSuggestions(draft, knownTags, value),
    [draft, knownTags, value],
  )
  const hasQuery = draft.trim().length > 0
  const showDropdown = open && !atLimit && hasQuery

  const listboxId = `${id}-listbox`
  const errorId = `${id}-error`
  const optionId = (index: number) => `${id}-option-${index}`

  // Flip above the input when there isn't enough room below it. The field
  // can end up anywhere in the form (and the dialog anywhere in the
  // viewport), so a fixed "always downward" dropdown would clip against the
  // viewport edge for a tag list near the bottom of a tall form.
  useLayoutEffect(() => {
    if (!showDropdown) return
    const el = wrapperRef.current
    if (!el) return
    const rowCount = Math.max(suggestions.length, 1)
    const estimatedHeight = rowCount * SUGGESTION_ROW_HEIGHT + SUGGESTION_LIST_PADDING
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    setDropUp(spaceBelow < estimatedHeight && spaceAbove > spaceBelow)
  }, [showDropdown, suggestions.length])

  function closeDropdown() {
    setOpen(false)
    setHighlightedIndex(null)
  }

  function addTag(raw: string) {
    const tag = canonicalizeTag(raw, knownTags)
    if (!tag || atLimit) return
    setDraft('')
    closeDropdown()
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return
    onChange([...value, tag])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return
      event.preventDefault()
      setOpen(true)
      setHighlightedIndex((idx) => (idx === null ? 0 : Math.min(idx + 1, suggestions.length - 1)))
      return
    }
    if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return
      event.preventDefault()
      setOpen(true)
      setHighlightedIndex((idx) =>
        idx === null ? suggestions.length - 1 : Math.max(idx - 1, 0),
      )
      return
    }
    if (event.key === 'Enter' || event.key === ',') {
      // Swallow both so a comma never lands in the field and Enter never
      // submits the enclosing form. Commits the highlighted suggestion when
      // one is picked via the keyboard, otherwise the raw typed text.
      event.preventDefault()
      const highlighted = highlightedIndex !== null ? suggestions[highlightedIndex] : undefined
      addTag(highlighted ?? draft)
      return
    }
    if (event.key === 'Escape') {
      if (!showDropdown) return
      // Stop propagation so Escape closes only the suggestion list, not the
      // whole dialog — Base UI's Dialog also closes on Escape.
      event.preventDefault()
      event.stopPropagation()
      closeDropdown()
      return
    }
    if (event.key === 'Tab') {
      // Let focus move on naturally; just stop suggesting.
      closeDropdown()
      return
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const liveMessage = !showDropdown
    ? ''
    : suggestions.length > 0
      ? `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} available`
      : 'No match — press Enter to add it anyway'

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="rounded-full p-0.5 outline-none transition-colors duration-150 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div ref={wrapperRef} className="relative">
        <Input
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showDropdown && highlightedIndex !== null ? optionId(highlightedIndex) : undefined
          }
          autoComplete="off"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setHighlightedIndex(null)
            setOpen(true)
          }}
          onFocus={() => {
            if (draft.trim()) setOpen(true)
          }}
          onBlur={closeDropdown}
          onKeyDown={handleKeyDown}
          disabled={atLimit}
          placeholder={atLimit ? 'Tag limit reached' : 'next.js, postgres…'}
          className="hover:border-ring/40"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        {showDropdown ? (
          <div
            role="listbox"
            id={listboxId}
            aria-label="Tech tag suggestions"
            className={`absolute inset-x-0 z-20 max-h-64 overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 ${
              dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
            {suggestions.length > 0 ? (
              suggestions.map((tag, index) => (
                <button
                  key={tag}
                  type="button"
                  id={optionId(index)}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    // mousedown fires before the input's blur — preventing
                    // its default keeps focus (and the list) put so the
                    // click actually lands instead of the dropdown closing
                    // out from under the pointer first.
                    e.preventDefault()
                    addTag(tag)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex w-full cursor-default items-center truncate rounded-md px-2.5 py-1.5 text-left outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground ${
                    highlightedIndex === index ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  {tag}
                </button>
              ))
            ) : (
              <p className="px-2.5 py-1.5 text-muted-foreground">
                No match — press Enter to add it anyway
              </p>
            )}
          </div>
        ) : null}
        <span role="status" aria-live="polite" className="sr-only">
          {liveMessage}
        </span>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : value.length >= TECH_TAGS_WARNING_THRESHOLD ? (
        <p
          className={`font-mono text-2xs tabular-nums ${atLimit ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {value.length}/{MAX_TECH_TAGS}
        </p>
      ) : null}
    </div>
  )
}
