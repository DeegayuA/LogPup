'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { askAuditFilters } from '@/features/admin/audit-nl-actions'
import { auditQueryString, type AuditParamState } from '@/features/admin/audit-filters'

/**
 * Ask the audit log a question in words, and get the page's own filters back.
 *
 * IT SETS THE FILTERS. It does not fetch rows, rank them, or answer in prose —
 * the chips above the table change, the count changes, and both stay editable
 * by hand. That is deliberate: this reads the record of who did what, and an
 * assistant returning a plausible-looking SUBSET of that record would be wrong
 * in the one way nobody could catch. Wrong chips are obvious; a wrong slice is
 * not.
 *
 * Sits beside the deterministic controls rather than replacing them, and is
 * never the only route to a filter. Somebody without an API key, or with the
 * feature switched off in Settings, loses a shortcut and nothing else.
 */
export function AuditAsk({ current }: { current: AuditParamState }) {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startAsking] = useTransition()

  function ask() {
    const trimmed = question.trim()
    if (!trimmed || pending) return
    setError(null)
    startAsking(async () => {
      try {
        const res = await askAuditFilters({
          question: trimmed,
          // The reader's current state travels along, so a question narrows
          // what is on screen rather than silently restarting from the
          // unfiltered log. Serialised through the same function the URL uses,
          // so there is one definition of what a filter state looks like.
          params: Object.fromEntries(new URLSearchParams(auditQueryString(current))),
        })
        if (!res.ok) {
          setError(res.error)
          return
        }
        router.push(res.data.href)
        // The question stays in the box on purpose: the filters it produced are
        // now visible above the table, and the likeliest next move is editing
        // the sentence rather than retyping it.
      } catch {
        setError('That did not go through — try again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Sparkles
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                ask()
              }
            }}
            maxLength={300}
            placeholder="Ask: what did Alex delete last week?"
            aria-label="Describe the audit rows you are looking for"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" disabled={pending || !question.trim()} onClick={ask}>
          {pending ? 'Reading…' : 'Set filters'}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-2xs text-destructive">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-2xs text-muted-foreground">
          Sets the filters below — it never picks the rows itself, so you can always see and
          correct what it asked for.
        </p>
      )}
    </div>
  )
}
