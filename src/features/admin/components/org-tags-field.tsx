'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Badge, badgeVariants } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const MAX_ORG_TAGS = 8
export const MAX_ORG_TAG_LENGTH = 30

// Erasable tag input for a user's organization labels: type + Enter adds a
// chip, each chip has an X to remove, and existing tags (from other users)
// are offered as one-click suggestions. Validation mirrors the server action
// (1-30 chars, max 8, deduped) so the API never sees an invalid list.
export function OrgTagsField({
  tags,
  onTagsChange,
  suggestions = [],
  inputId,
  disabled = false,
}: {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  suggestions?: string[]
  inputId: string
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    if (tag.length > MAX_ORG_TAG_LENGTH) {
      setError(`Keep it under ${MAX_ORG_TAG_LENGTH} characters`)
      return
    }
    if (tags.includes(tag)) {
      setDraft('')
      return
    }
    if (tags.length >= MAX_ORG_TAGS) {
      setError(`Up to ${MAX_ORG_TAGS} organizations per user`)
      return
    }
    onTagsChange([...tags, tag])
    setDraft('')
    setError(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Always swallow Enter here so it never submits an enclosing form.
      event.preventDefault()
      addTag(draft)
      return
    }
    if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onTagsChange(tags.slice(0, -1))
    }
  }

  const remaining = suggestions.filter(
    (s) =>
      !tags.includes(s) &&
      s.toLowerCase().includes(draft.trim().toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                disabled={disabled}
                onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
                className="rounded-full p-0.5 outline-none transition-colors duration-150 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                <X aria-hidden className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Input
        id={inputId}
        value={draft}
        disabled={disabled}
        maxLength={MAX_ORG_TAG_LENGTH}
        placeholder="Type an organization, press Enter"
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onKeyDown={handleKeyDown}
      />
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Press Enter to add. Up to {MAX_ORG_TAGS}.
        </p>
      )}
      {remaining.length > 0 ? (
        <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => addTag(s)}
              className={cn(
                badgeVariants({ variant: 'outline' }),
                'cursor-pointer outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
