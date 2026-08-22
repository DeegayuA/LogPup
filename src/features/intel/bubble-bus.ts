/**
 * How anything on the page asks the Ask-LogPup bubble to open.
 *
 * The bubble used to be one of two surfaces onto the same panels; /intel was
 * the other, and every palette row simply navigated to it. With that page gone
 * the bubble is the ONLY surface, so the palette needs a way to open it rather
 * than a URL to send somebody to.
 *
 * A window event rather than a context: the bubble is mounted once by the app
 * layout, and the callers are a command registry (a plain data module that must
 * not import React) and a dialog already deep inside its own provider tree. An
 * event has no provider to thread and no import cycle to create — and the
 * registry file's own header warns, at length, about what a careless import
 * from there costs.
 *
 * ONE MODULE so the event name exists once. Two string literals in two files is
 * the drift that makes a palette row silently stop working.
 */

const EVENT = 'logpup:intel-bubble'

/** Which half of the bubble to show when it opens. */
export type BubbleView = 'ask' | 'intel'

export type OpenBubbleRequest = {
  view: BubbleView
  /**
   * Prefills the question box. Only meaningful for the 'ask' view — it comes
   * from the palette's "Ask about '<query>'" row, which exists so a search that
   * found nothing does not make somebody retype what they just typed.
   */
  question?: string
  /**
   * Which region of the intel view to show first. The old page anchored these
   * as URL fragments (#briefing, #signals); the bubble has no URL, so the
   * intent travels here instead.
   */
  region?: 'briefing' | 'signals'
}

/**
 * Ask the bubble to open. A no-op on the server, and on any page where the
 * bubble is not mounted — callers are UI affordances, and one that quietly does
 * nothing beats one that throws at somebody mid-keystroke.
 */
export function openIntelBubble(request: OpenBubbleRequest): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<OpenBubbleRequest>(EVENT, { detail: request }))
}

/** The bubble's side of the same contract. Returns its own unsubscribe. */
export function subscribeIntelBubble(onOpen: (request: OpenBubbleRequest) => void): () => void {
  function handle(event: Event) {
    // Defensive: a CustomEvent with no detail is what a bare `new Event(EVENT)`
    // from anywhere else would look like, and defaulting to the ask view is the
    // harmless reading of it.
    const detail = (event as CustomEvent<OpenBubbleRequest>).detail
    onOpen(detail ?? { view: 'ask' })
  }
  window.addEventListener(EVENT, handle)
  return () => window.removeEventListener(EVENT, handle)
}
