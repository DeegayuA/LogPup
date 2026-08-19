'use client'

import { useEffect } from 'react'

/**
 * The only client JavaScript on /home, and it is deliberately subtractive:
 * the server always emits the finished, fully visible page, and this effect
 * is the sole thing that ever hides anything.
 *
 * That inversion is not stylistic. Google's OAuth reviewer fetches this URL
 * with no session and, in the worst case, no scripting, before granting the
 * sensitive calendar.events scope. If the reveal were built the usual way —
 * server-render at opacity 0, let JS fade it in — a scripting-off fetch would
 * receive a blank page, the scope would be refused, and nothing would look
 * wrong to a signed-in developer with JS on. So there is no opacity:0 in the
 * server output anywhere; `data-motion` on the page root is what arms the
 * rules in globals.css at all, and it is only ever set from here.
 *
 * The masthead is not routed through this observer: it sits above the fold,
 * so it uses tw-animate-css `motion-safe:animate-in` instead. A CSS animation
 * with fill-mode both runs AND ends at the visible final state with scripting
 * disabled, which keeps JS off the most important block on the page.
 *
 * Rejected: CSS scroll-driven animation via `animation-timeline: view()`.
 * Elegant and JS-free, but Firefox has no support and its no-support fallback
 * is the animation's `from` state — i.e. invisible. That is precisely the one
 * failure mode this route cannot have.
 */
export function RevealScope({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId)
    if (!root) return

    // Bail before anything is stamped rather than defining the animation and
    // turning it off: with no `data-motion` there is nothing to disable, so a
    // reduced-motion reader gets the same DOM the server sent.
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return

    /* `[data-stamp]` is the fortnight strip's cells. They join the same
       classification pass as everything else, so they inherit the whole
       guarantee unchanged: nothing is hidden in server output, only what is
       already below the fold is ever marked pending, and a reader with
       scripting off gets the finished strip the server sent. */
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>('[data-reveal], [data-rule], [data-stamp]'),
    )

    // Strictly below the viewport, not a fraction of it. An earlier fold at
    // 0.85 * innerHeight would mark the band between 85% and 100% as pending
    // — those nodes ARE on screen, so arming the transition and the hidden
    // state in the same style change would fade them out and then, on the
    // observer's first callback, straight back in. A visible flicker on the
    // first paint is worse than a slightly later reveal.
    const fold = window.innerHeight
    const pending = nodes.filter((node) => node.getBoundingClientRect().top >= fold)
    for (const node of pending) node.setAttribute('data-pending', '')

    // Stamped after the pending marks, so there is no ordering in which the
    // rules can match a node that has not been classified yet. Both writes
    // land in the same task, so the browser never paints between them.
    root.setAttribute('data-motion', 'on')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.removeAttribute('data-pending')
          observer.unobserve(entry.target)
        }
      },
      // A fixed 40px rather than a percentage: a percentage of a tall viewport
      // can exceed the height of everything below the last revealed element,
      // which would strand it hidden at the bottom of the page forever.
      { rootMargin: '0px 0px -40px 0px' },
    )
    for (const node of pending) observer.observe(node)
    return () => observer.disconnect()
  }, [rootId])

  return null
}
