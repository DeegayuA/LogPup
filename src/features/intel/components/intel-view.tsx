'use client'

import * as React from 'react'
import { Loader2Icon, TriangleAlert } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { getBriefing, getSignals, type Briefing } from '@/features/intel/actions'
import type { Signal } from '@/features/intel/signals'
import { BriefingCard } from '@/features/intel/components/briefing-card'
import { SignalBoard } from '@/features/intel/components/signal-board'

/**
 * Everything LogPup noticed, inside the bubble.
 *
 * This replaces the /intel page, which was removed. It renders the SAME
 * BriefingCard and SignalBoard that page did — a second surface, not a second
 * implementation, which is the rule the bubble already followed for the ask
 * panel.
 *
 * TWO READS, TWO STATES, ON PURPOSE. The page split these across two Suspense
 * boundaries because they cost very different things: signals are a batched
 * database read, the briefing is a Gemini call that can take seconds. That
 * split is preserved here as two separate states, so the board — the one thing
 * here that must be readable immediately, and the one that works with AI
 * switched off entirely — never waits on the model.
 *
 * SEQUENCED, NOT RACED. This said "two independent loads" and fired them
 * together, which the transport does not honour: Next serialises server
 * actions from one client. The briefing went first, hung on a Gemini call that
 * had no timeout, and the fast signals read queued behind it never ran — two
 * panels frozen on their loading state with nothing rejecting, so neither
 * error branch fired. Signals is awaited first now, which is what "the board
 * never waits on the model" actually requires.
 *
 * CLIENT-SIDE, unlike the page, and that is forced rather than chosen: a dialog
 * body cannot be a server component. The cost is a spinner on first open; the
 * mitigation is that the cheap half is asked for first and lands in a couple of
 * hundred milliseconds.
 *
 * FETCHED ONCE PER MOUNT. The bubble discards this on close, so reopening
 * re-reads — right for a surface whose whole claim is "what is true now", and
 * cheap for the half that matters.
 */

type Load<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; message: string }

export function IntelView({ region }: { region?: 'briefing' | 'signals' }) {
  const [signals, setSignals] = React.useState<Load<Signal[]>>({ state: 'loading' })
  const [briefing, setBriefing] = React.useState<Load<Briefing>>({ state: 'loading' })

  /* Both start together and land independently. `live` guards the setState
     against a bubble closed mid-flight — a dialog is closed mid-request far
     more often than a page is navigated away from. */
  React.useEffect(() => {
    let live = true

    // SEQUENCED, NOT RACED — and that is a correction, not a preference.
    //
    // These were fired together on the belief that they were independent
    // boundaries: signals a batched database read, the briefing a Gemini call
    // that can take seconds. Next serialises server actions from one client,
    // so they were never independent. The briefing went first, hung on a
    // Gemini request that had no timeout, and the 200ms signals read queued
    // behind it never ran — one stuck upstream call, two panels frozen on
    // their loading state, and neither .catch fired because nothing rejected.
    //
    // Signals first, therefore: the fast, always-available half renders while
    // the slow, externally-dependent half is still working, which is what the
    // two separate boundaries were for in the first place.
    void (async () => {
      try {
        const res = await getSignals()
        if (live) {
          setSignals(
            res.ok ? { state: 'ok', data: res.data } : { state: 'error', message: res.error },
          )
        }
      } catch {
        if (live) setSignals({ state: 'error', message: 'Could not reach the signals.' })
      }

      // Started only once signals has landed. Awaiting it here costs nothing
      // that the transport was not already charging silently.
      try {
        const res = await getBriefing()
        if (live) {
          setBriefing(
            res.ok ? { state: 'ok', data: res.data } : { state: 'error', message: res.error },
          )
        }
      } catch {
        if (live) setBriefing({ state: 'error', message: 'Could not reach the briefing.' })
      }
    })()

    return () => {
      live = false
    }
  }, [])

  /* The old page anchored #briefing and #signals so a palette row could land
     on the panel somebody asked for. A dialog has no fragment, so the region is
     scrolled to instead — once, and only after the section it names has
     actually rendered, or there is nothing to scroll to. */
  const briefingRef = React.useRef<HTMLElement>(null)
  const signalsRef = React.useRef<HTMLElement>(null)
  const scrolled = React.useRef(false)

  React.useEffect(() => {
    if (!region || scrolled.current) return
    const target = region === 'briefing' ? briefingRef.current : signalsRef.current
    if (!target) return
    scrolled.current = true
    target.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [region, signals.state, briefing.state])

  return (
    <div className="flex flex-col gap-4">
      <section ref={briefingRef} aria-label="Morning briefing" className="scroll-mt-2">
        {briefing.state === 'loading' ? (
          <div
            className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/60 p-4 text-xs text-muted-foreground"
            role="status"
          >
            <Loader2Icon aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
            Writing today&rsquo;s briefing…
          </div>
        ) : briefing.state === 'error' ? (
          // Scoped to this half. The board below is an independent read and
          // keeps working — the whole reason the two are not awaited together.
          <RegionError title="No briefing this time">
            {briefing.message} The signals it would have been written from are below.
          </RegionError>
        ) : (
          <BriefingCard initial={briefing.data} />
        )}
      </section>

      <section ref={signalsRef} aria-label="LogPup signals" className="scroll-mt-2">
        {signals.state === 'loading' ? (
          <div className="flex flex-col gap-2" aria-hidden>
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : signals.state === 'error' ? (
          <RegionError title="The signals wouldn’t load">
            {signals.message} Nothing here is lost — ask the box for the same thing in words.
          </RegionError>
        ) : (
          <SignalBoard signals={signals.data} />
        )}
      </section>
    </div>
  )
}

/**
 * A failed region, in the shape bug-list.tsx uses: named, announced, and
 * printing the reason it was given rather than a shrug.
 */
function RegionError({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}
