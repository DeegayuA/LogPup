'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ArrowRight, MessageCircleQuestion, Radar, X } from 'lucide-react'

import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { AskPanel } from '@/features/intel/components/ask-panel'
import { IntelView } from '@/features/intel/components/intel-view'
import { subscribeIntelBubble, type BubbleView } from '@/features/intel/bubble-bus'

/**
 * "Ask LogPup" on every authed page — a floating trigger opening the SAME
 * AskPanel that /intel renders.
 *
 * A SECOND SURFACE, NOT A SECOND IMPLEMENTATION. The panel already owns the
 * question box, the conversation, the citation rendering and the grounded /
 * ungrounded distinction. Forking any of that would give the two surfaces two
 * behaviours and, eventually, two answers to the same question. This file is a
 * shell: a button, a sheet, and the rules for opening and closing it.
 *
 * TWO HALVES SINCE /intel WAS REMOVED. The ask panel is one; the other is
 * everything LogPup noticed — the briefing and the ranked signals that page
 * used to hold. An arrow in the header moves between them.
 *
 * `canAsk` NO LONGER GATES MOUNTING, and that change is load-bearing. It used
 * to: "a bubble on every page that then refuses to answer is worse than no
 * bubble". But signals are deliberately AI-FREE — signals.ts exists so that a
 * reader with AI switched off, or a key that just got rejected, still gets the
 * whole list of things that need them. Gating the only remaining surface on
 * askAvailable() would have made that list unreachable for exactly the readers
 * it was written for.
 *
 * So the bubble always mounts, and `canAsk` decides what it IS: with AI it is
 * Ask LogPup, opening on the question box. Without, it is LogPup's signal
 * board, wearing the radar icon, with no ask affordance offered anywhere. The
 * old rule is kept — nothing advertises a capability the account does not
 * have — it just no longer takes the signals down with it.
 */
export function AskBubble({
  canAsk = true,
  className,
}: {
  /**
   * Whether this account can actually get an answer. Resolved once by the
   * layout (askAvailable() owns routed-ness, the feature pref and key presence
   * together), because a client-side probe would flash the wrong surface.
   */
  canAsk?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  /* Without AI there is only one half, and it is the intel one. */
  const [view, setView] = React.useState<BubbleView>(canAsk ? 'ask' : 'intel')
  const [region, setRegion] = React.useState<'briefing' | 'signals' | undefined>(undefined)
  const [prefill, setPrefill] = React.useState('')

  /* The palette opens this instead of navigating to /intel, which no longer
     exists. It names the half it wants, so "Today's briefing" still lands on
     the briefing rather than on whatever was open last time. */
  React.useEffect(
    () =>
      subscribeIntelBubble((request) => {
        const wanted = request.view === 'ask' && !canAsk ? 'intel' : request.view
        setView(wanted)
        setRegion(request.region)
        if (request.question !== undefined) setPrefill(request.question)
        setOpen(true)
      }),
    [canAsk],
  )

  /**
   * ⌘/ (Ctrl+/) toggles it. Not a bare letter: the palette already owns the
   * single-key space through its g-jumps, and a plain "a" would fire mid-word
   * for anybody typing in a field this bubble floats over. A modifier chord is
   * also exempt from the WCAG 2.1.4 single-key opt-out the g-jumps carry.
   */
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== '/' || !(event.metaKey || event.ctrlKey)) return
      // Never steal the chord out of a field: somebody typing in the command
      // palette is not asking to open a chat panel.
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return
      }
      event.preventDefault()
      setOpen((wasOpen) => !wasOpen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Bottom-right, above the safe-area inset so it clears an iOS home bar.
          Hidden while the sheet is open, so the trigger never floats over its
          own panel. */}
      <button
        type="button"
        aria-label={canAsk ? 'Ask LogPup' : 'What LogPup noticed'}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          'fixed right-4 z-30 flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-primary-foreground shadow-lg',
          'bottom-[calc(1rem+env(safe-area-inset-bottom))]',
          'outline-none transition-[background-color,box-shadow,transform] duration-150 ease-out',
          'hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0',
          open && 'pointer-events-none opacity-0',
          className,
        )}
      >
        {canAsk ? (
          <MessageCircleQuestion className="size-5 shrink-0" aria-hidden />
        ) : (
          <Radar className="size-5 shrink-0" aria-hidden />
        )}
        <span className="hidden text-sm font-medium sm:inline">
          {canAsk ? 'Ask LogPup' : 'Signals'}
        </span>
      </button>

      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="ask-bubble"
          aria-label="Ask LogPup"
          className={cn(
            // A SHEET, not a centred modal: this is a companion to the page
            // behind it — somebody asks about what they are looking at — and a
            // centred dialog would say "stop what you were doing". Full width
            // on a phone, a right-hand column from `sm` up.
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[85svh] flex-col rounded-t-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none',
            'sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-h-[min(38rem,85svh)] sm:w-[26rem] sm:rounded-2xl',
            // svh, not vh: mobile browser chrome resizes the viewport, and vh
            // would leave the panel taller than the screen while the bar shows.
            'duration-200 ease-out motion-reduce:transition-none motion-reduce:animate-none',
            'data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-4',
          )}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-3">
            {view === 'ask' ? (
              <MessageCircleQuestion className="size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <Radar className="size-4 shrink-0 text-primary" aria-hidden />
            )}
            <DialogTitle className="flex-1 text-sm font-semibold">
              {view === 'ask' ? 'Ask LogPup' : 'What LogPup noticed'}
            </DialogTitle>

            {/* The two halves, one arrow. Offered only when there ARE two:
                without AI the ask panel cannot answer, so a control leading to
                it would advertise a dead end on every page.

                It carries a LABEL as well as a direction, because an arrow
                alone says "forward" and not "forward to what" — and it flips
                with the view so the button always names where it goes rather
                than where you are. */}
            {canAsk ? (
              <Button
                variant="ghost"
                size="xs"
                aria-label={
                  view === 'ask' ? 'Show what LogPup noticed' : 'Back to asking a question'
                }
                onClick={() => {
                  setView((current) => (current === 'ask' ? 'intel' : 'ask'))
                  // A manual switch is not a deep link: clear the region so it
                  // does not scroll somewhere the person did not ask for.
                  setRegion(undefined)
                }}
                className="text-muted-foreground"
              >
                <span className="hidden sm:inline">{view === 'ask' ? 'Signals' : 'Ask'}</span>
                <ArrowRight
                  aria-hidden
                  className={cn(
                    'transition-transform duration-150 ease-out motion-reduce:transition-none',
                    view === 'intel' && 'rotate-180',
                  )}
                />
              </Button>
            ) : null}

            <Kbd className="hidden sm:inline-flex">⌘/</Kbd>
            <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label="Close" />}>
              <X aria-hidden />
            </DialogClose>
          </header>

          {/* The panel scrolls inside the sheet rather than the sheet growing:
              a conversation is unbounded and the header must stay reachable. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {view === 'ask' ? (
              <AskPanel initialQuestion={prefill} />
            ) : (
              /* Keyed on `open` so closing the sheet discards it: the intel
                 view reads on mount, and "what is true now" must not be
                 answered by whatever was true when it was last opened. */
              <IntelView key={open ? 'open' : 'closed'} region={region} />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
