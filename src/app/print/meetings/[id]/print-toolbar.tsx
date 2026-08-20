'use client'

import Link from 'next/link'
import { FileDown, SlidersHorizontal } from 'lucide-react'

/**
 * Screen-only chrome above the A4 preview. The button drives the browser's
 * print pipeline because that IS the PDF path here: browser text shaping is
 * the only renderer that gets Sinhala right (PDF libraries mangle complex
 * scripts), and "Save as PDF" in the print dialog produces the file.
 * Everything here disappears in the printed output via `print:hidden`.
 *
 * Every control is a link, not client state. The detail level decides what the
 * server fetches at all (the full record's transcript can be hundreds of KB),
 * and the composition — which sections are in — lives in the same URL, so a
 * document somebody shaped is a link they can send on or bookmark for a
 * recurring report. The page stays a server component as a result.
 *
 * The order left to right is the order of the job: choose the level, shape the
 * document, then save it. Save sits last and alone on the right because it is
 * the only step that leaves the page.
 */
export function PrintToolbar({
  summaryHref,
  fullHref,
  full,
  editing,
  editHref,
  hiddenCount,
  showAllHref,
}: {
  summaryHref: string
  fullHref: string
  full: boolean
  /** Section hide/show controls are showing on the sheet below. */
  editing: boolean
  /** This same document with edit mode flipped. */
  editHref: string
  /** Sections this meeting HAS that the reader has left out. */
  hiddenCount: number
  showAllHref: string
}) {
  // Document tokens, not hard-coded zinc/white: the screen chrome pulls its
  // greys from the same pinned palette as the sheet (see page.tsx doc-root),
  // so the route has ONE source of colour. The focus outline matches the
  // page's other controls — the tabs used to be the only ones without it.
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--doc-brand)] ${
      active
        ? 'bg-[var(--doc-brand)] text-[var(--doc-paper)]'
        : 'text-[var(--doc-ink-soft)] hover:bg-[var(--doc-wash)] hover:text-[var(--doc-ink)]'
    }`

  return (
    // Opaque, not `bg-white/95 backdrop-blur`. A translucent bar over a white
    // sheet let the document's own heading show THROUGH it while scrolling —
    // two overlapping lines of text ("MEETING MINUTES" behind the tab labels)
    // that read as a rendering fault rather than a sticky toolbar. z-20 keeps
    // it above the sheet, which carries a shadow of its own.
    <div className="sticky top-0 z-20 border-b border-[color:var(--doc-rule)] bg-[var(--doc-paper)] shadow-sm print:hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <nav
          aria-label="Export detail level"
          className="flex items-center gap-1 rounded-lg border border-[color:var(--doc-rule)] p-0.5"
        >
          <Link href={summaryHref} className={tab(!full)} aria-current={!full ? 'page' : undefined}>
            Summary
          </Link>
          <Link href={fullHref} className={tab(full)} aria-current={full ? 'page' : undefined}>
            Full record
          </Link>
        </nav>

        <p className="text-sm text-[var(--doc-ink-faint)] max-lg:hidden">
          A4 preview — choose <span className="font-medium text-[var(--doc-ink-soft)]">Save as PDF</span> in the
          print dialog.
        </p>

        {/* A link rather than a toggle button: the mode is a place in the URL,
            so it survives a reload and travels with the document. The label
            states the action either way, which is what a link's accessible
            name has to do — there is no pressed state to announce. */}
        <Link
          href={editHref}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${
            editing
              ? 'border-[var(--doc-brand)] bg-[var(--doc-brand-wash)] text-[var(--doc-brand-deep)]'
              : 'border-[color:var(--doc-rule-strong)] text-[var(--doc-ink-soft)] hover:bg-[var(--doc-wash)]'
          } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--doc-brand)]`}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {editing ? 'Done choosing sections' : 'Choose sections'}
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--doc-brand)] px-3 py-1.5 text-sm font-medium text-[var(--doc-paper)] hover:bg-[var(--doc-brand-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--doc-brand)]"
        >
          <FileDown aria-hidden className="size-4" />
          Save as PDF
        </button>
      </div>

      {/* Somebody opening a bookmarked or forwarded link must not be left
          wondering where the glossary went — the omission is stated, with the
          way back, before they scroll into a document that is missing things.
          aria-live because the count changes under navigation, not reload. */}
      {hiddenCount > 0 ? (
        <p
          aria-live="polite"
          className="flex flex-wrap items-center gap-x-2 border-t border-[color:var(--doc-rule)] bg-[var(--doc-wash)] px-4 py-1.5 text-sm text-[var(--doc-ink-soft)]"
        >
          <span>
            {hiddenCount === 1 ? '1 section is' : `${hiddenCount} sections are`} hidden and will not
            be printed.
          </span>
          <Link
            href={showAllHref}
            className="font-medium text-[var(--doc-brand-deep)] underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--doc-brand)]"
          >
            Show all
          </Link>
        </p>
      ) : null}
    </div>
  )
}
