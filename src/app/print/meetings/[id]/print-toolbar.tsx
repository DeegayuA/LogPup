'use client'

import Link from 'next/link'
import { FileDown } from 'lucide-react'

/**
 * Screen-only chrome above the A4 preview. The button drives the browser's
 * print pipeline because that IS the PDF path here: browser text shaping is
 * the only renderer that gets Sinhala right (PDF libraries mangle complex
 * scripts), and "Save as PDF" in the print dialog produces the file.
 * Everything here disappears in the printed output via `print:hidden`.
 *
 * The Summary/Full record pair are links, not client state: the full record
 * (complete transcript + every timeline entry) is fetched server-side only
 * when asked for, so the default export never pays for a long meeting's
 * whole transcript.
 */
export function PrintToolbar({ meetingId, full }: { meetingId: string; full: boolean }) {
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
    }`

  return (
    // Opaque, not `bg-white/95 backdrop-blur`. A translucent bar over a white
    // sheet let the document's own heading show THROUGH it while scrolling —
    // two overlapping lines of text ("MEETING MINUTES" behind the tab labels)
    // that read as a rendering fault rather than a sticky toolbar. z-20 keeps
    // it above the sheet, which carries a shadow of its own.
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 shadow-sm print:hidden">
      <nav aria-label="Export detail level" className="flex items-center gap-1 rounded-lg border border-zinc-200 p-0.5">
        <Link href={`/print/meetings/${meetingId}`} className={tab(!full)} aria-current={!full ? 'page' : undefined}>
          Summary
        </Link>
        <Link href={`/print/meetings/${meetingId}?full=1`} className={tab(full)} aria-current={full ? 'page' : undefined}>
          Full record
        </Link>
      </nav>
      <p className="text-sm text-zinc-500 max-sm:hidden">
        A4 preview — choose <span className="font-medium text-zinc-700">Save as PDF</span> in the print dialog.
      </p>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
      >
        <FileDown aria-hidden className="size-4" />
        Save as PDF
      </button>
    </div>
  )
}
