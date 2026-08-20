'use client'

import * as React from 'react'
import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { getBriefing, type Briefing } from '@/features/intel/actions'
import {
  formatBusinessTime,
  formatBusinessWeekdayDayMonth,
} from '@/features/people/format-instant'
import { cn } from '@/lib/utils'

/**
 * The morning briefing, rendered from a server-supplied `initial` so the
 * first paint costs no round trip and no skeleton. The client half exists
 * only for Refresh and Copy — a briefing that had to be fetched by the
 * browser would leave the most prominent thing on the page empty for as long
 * as Gemini takes.
 */
export function BriefingCard({
  initial,
  className,
}: {
  initial: Briefing
  className?: string
}) {
  const [briefing, setBriefing] = React.useState(initial)
  const [refreshing, setRefreshing] = React.useState(false)
  /* Inline, not a toast: the reader is looking at the briefing, and a failed
     refresh has to explain itself where the stale copy still sits. */
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  /* Refresh disables itself while it runs, and a browser drops focus from a
     disabled element onto <body> — so the click that started the refresh also
     resets the reader's tab position to the top of the document. Remembered
     here and restored below, but only if the refresh is what took focus away. */
  const refreshRef = React.useRef<HTMLButtonElement>(null)
  const hadFocus = React.useRef(false)

  React.useEffect(() => {
    if (refreshing || !hadFocus.current) return
    hadFocus.current = false
    if (document.activeElement === document.body) refreshRef.current?.focus()
  }, [refreshing])

  async function refresh() {
    hadFocus.current =
      document.activeElement !== null && document.activeElement !== document.body
    setRefreshing(true)
    setError(null)
    try {
      const res = await getBriefing()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setBriefing(res.data)
    } catch {
      setError('Could not reach the briefing — try again')
    } finally {
      setRefreshing(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(toMarkdown(briefing))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Briefing copied as markdown')
    } catch {
      toast.error('Could not copy — select the text instead')
    }
  }

  const generatedAt = new Date(briefing.generatedAtIso)

  return (
    <SpotlightCard
      className={cn(
        'rounded-2xl border border-border/70 bg-card/60 shadow-xs backdrop-blur-sm',
        className,
      )}
    >
      <div className="relative flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 font-mono text-2xs font-semibold tracking-[0.18em] text-primary uppercase">
            <Sparkles aria-hidden className="size-3.5" />
            Morning briefing
            <span className="font-normal tracking-normal text-muted-foreground normal-case">
              · {formatBusinessWeekdayDayMonth(generatedAt)},{' '}
              {formatBusinessTime(generatedAt)}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              aria-label="Copy the briefing as markdown"
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              ref={refreshRef}
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw
                aria-hidden
                className={cn(refreshing && 'animate-spin motion-reduce:animate-none')}
              />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>
        </div>

        {refreshing ? (
          <BriefingBodyPending priorities={briefing.priorities.length} />
        ) : (
          <>
            <h2 className="font-heading text-xl font-bold tracking-tight text-balance text-foreground sm:text-2xl">
              {briefing.headline}
            </h2>

            {briefing.body ? (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {briefing.body}
              </p>
            ) : null}

            {briefing.priorities.length > 0 ? (
              <ol className="flex flex-col gap-2 border-t border-border/50 pt-3.5">
                {briefing.priorities.map((priority, index) => (
                  <li key={priority} className="flex items-baseline gap-2.5 text-sm">
                    <span
                      aria-hidden
                      className="font-mono text-2xs font-bold tabular-nums text-primary"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 text-foreground">{priority}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        )}

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground"
          >
            {error} — the briefing above is the one from{' '}
            {formatBusinessTime(generatedAt)}.
          </p>
        ) : null}

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
          {briefing.source === 'derived' ? (
            /* Quiet and factual. A derived briefing is a working briefing —
               the numbers are the same ones the board ranks — so it must not
               wear error chrome. It says which of the two it is, and stops. */
            <span>
              Written from your own numbers — the AI briefing is off or
              unavailable.
            </span>
          ) : (
            <span>Written by {briefing.model ?? 'Gemini'} from your workspace data.</span>
          )}
        </p>
      </div>
    </SpotlightCard>
  )
}

/**
 * Skeleton lines, never a spinner: the briefing is prose of a known shape, so
 * the pending state can promise that shape. The Refresh button's own icon is
 * the only thing that spins, because a button IS reporting progress.
 */
function BriefingBodyPending({ priorities }: { priorities: number }) {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <span className="sr-only" role="status">
        Refreshing your briefing
      </span>
      <Skeleton className="h-7 w-3/4" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex flex-col gap-2 border-t border-border/50 pt-3.5">
        {Array.from({ length: Math.max(priorities, 1) }, (_, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Clean markdown, not a screenshot of the DOM: this text is pasted into
 * standups and Notion, so the headline is a heading and the priorities are a
 * real numbered list. The provenance line travels with it — a briefing
 * forwarded without saying whether a model wrote it is the one way this
 * feature could mislead someone downstream.
 */
function toMarkdown(briefing: Briefing): string {
  const lines = [`## ${briefing.headline}`, '']
  if (briefing.body) lines.push(briefing.body, '')
  if (briefing.priorities.length > 0) {
    briefing.priorities.forEach((priority, index) => {
      lines.push(`${index + 1}. ${priority}`)
    })
    lines.push('')
  }
  lines.push(
    briefing.source === 'derived'
      ? '_Written from LogPup data, not by AI._'
      : `_Written by ${briefing.model ?? 'Gemini'} from LogPup data._`,
  )
  return lines.join('\n')
}
