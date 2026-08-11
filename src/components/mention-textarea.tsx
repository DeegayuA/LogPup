'use client'

import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'

export type MentionUser = { id: string; name: string }

type ActiveMention = { start: number; query: string }

/*
 * Finds the "@token" the caret is currently inside: the nearest '@' before
 * the caret that starts a word (start of text or after whitespace), with no
 * whitespace between it and the caret. Inserted mentions end with a space,
 * so completing one closes the popover on its own.
 */
function findActiveMention(value: string, caret: number): ActiveMention | null {
  const upToCaret = value.slice(0, caret)
  const at = upToCaret.lastIndexOf('@')
  if (at === -1) return null
  if (at > 0 && !/\s/.test(upToCaret[at - 1])) return null
  const query = upToCaret.slice(at + 1)
  if (/\s/.test(query)) return null
  return { start: at, query }
}

export function MentionTextarea({
  users,
  value,
  onValueChange,
  onMention,
  onKeyDown,
  onBlur,
  onSelect,
  ...props
}: Omit<React.ComponentProps<'textarea'>, 'value' | 'onChange' | 'defaultValue'> & {
  users: MentionUser[]
  value: string
  onValueChange: (value: string) => void
  onMention?: (user: MentionUser) => void
}) {
  const listId = React.useId()
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = React.useState<ActiveMention | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  /* The '@' position the user escaped out of — stays closed until they leave that token. */
  const [dismissedStart, setDismissedStart] = React.useState<number | null>(null)

  const suggestions = React.useMemo(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6)
  }, [mention, users])

  const open = mention !== null && suggestions.length > 0 && dismissedStart !== mention.start
  const active = Math.min(activeIndex, Math.max(suggestions.length - 1, 0))

  function syncMention(el: HTMLTextAreaElement) {
    const next = findActiveMention(el.value, el.selectionStart ?? el.value.length)
    if (next?.start !== dismissedStart) setDismissedStart(null)
    if (next?.start !== mention?.start || next?.query !== mention?.query) setActiveIndex(0)
    setMention(next)
  }

  function insertMention(user: MentionUser) {
    const el = textareaRef.current
    if (!el || !mention) return
    const caret = el.selectionStart ?? value.length
    const before = value.slice(0, mention.start)
    const after = value.slice(caret)
    const inserted = `@${user.name} `
    onValueChange(before + inserted + after)
    onMention?.(user)
    setMention(null)
    /* The controlled re-render moves the caret to the end; put it back
       right after the inserted mention. Focus never leaves the textarea. */
    const position = before.length + inserted.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(position, position)
    })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open && !event.nativeEvent.isComposing) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((active + 1) % suggestions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((active - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        insertMention(suggestions[active])
        return
      }
      if (event.key === 'Escape') {
        /* Swallow it so a surrounding dialog doesn't close too. */
        event.preventDefault()
        event.stopPropagation()
        setDismissedStart(mention.start)
        setMention(null)
        return
      }
    }
    onKeyDown?.(event)
  }

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          syncMention(event.target)
        }}
        onSelect={(event) => {
          syncMention(event.currentTarget)
          onSelect?.(event)
        }}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          setMention(null)
          onBlur?.(event)
        }}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${suggestions[active].id}` : undefined}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention a teammate"
          className="absolute top-full left-0 z-50 mt-1 max-h-56 w-60 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-border"
        >
          {suggestions.map((user, index) => (
            <li
              key={user.id}
              id={`${listId}-${user.id}`}
              role="option"
              aria-selected={index === active}
              data-selected={index === active || undefined}
              className="cursor-default rounded-md px-2 py-1.5 text-sm select-none data-selected:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertMention(user)}
              onMouseMove={() => setActiveIndex(index)}
            >
              <span aria-hidden className="mr-1 text-muted-foreground">
                @
              </span>
              {user.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
