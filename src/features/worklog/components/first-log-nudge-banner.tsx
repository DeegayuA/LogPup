'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NotebookPen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Client half of FirstLogNudge. The server decided this should render; the
 * only state here is the user clicking ✕ — an event handler, so plain
 * setState with no effect gymnastics. The cookie makes the dismissal stick
 * across sessions; the local state makes it instant.
 *
 * Same shell as PasskeyNudgeBanner on purpose — a new account can see both,
 * and two banners in one voice read as one calm strip, where two colours
 * would read as two alarms.
 */
export function FirstLogNudgeBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <NotebookPen aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        A work log is your own account of the day — one line, and how far you got against what you
        planned. It takes seconds, and nobody else can write it for you.
      </p>
      <Button size="sm" render={<Link href="/worklog" />}>
        Log today
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Dismiss work log suggestion"
        onClick={() => {
          // As permanent as a cookie is allowed to be — browsers cap the
          // lifetime at 400 days. The real off-switch is the entry count:
          // one logged day retires this banner for good, cookie or not.
          document.cookie = 'logpup-first-log-nudge=1;path=/;max-age=34560000;samesite=lax'
          setDismissed(true)
        }}
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}
