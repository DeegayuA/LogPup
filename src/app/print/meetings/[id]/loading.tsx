import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route skeleton for the export page. The full-record fetch is acknowledged
 * to run to hundreds of KB (see page.tsx around getMeetingNoteTimeline) plus
 * a getMeetingIntel round trip, and until this file existed the reader got a
 * blank tab for the whole wait.
 *
 * Shaped like what arrives: the sticky toolbar bar, then an A4 sheet with a
 * masthead lockup, a fact block, and numbered-section rules. App tokens
 * rather than the document's pinned palette — the doc-* custom properties
 * live in page.tsx's style block and do not exist yet while this renders.
 *
 * `role="status"` + sr-only text: a page of unlabeled grey boxes announces
 * nothing to a screen reader, and this wait is long enough to need naming.
 */
export default function MeetingPrintLoading() {
  return (
    <div role="status" className="min-h-screen bg-background">
      <span className="sr-only">Preparing the document…</span>

      {/* The toolbar strip — same height band the real one occupies. */}
      <div aria-hidden className="border-b border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="ml-auto h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* The sheet: same geometry as .doc-sheet so the document lands in
          place instead of reflowing the page. */}
      <div
        aria-hidden
        className="mx-auto my-8 w-[210mm] max-w-full rounded-sm border border-border bg-card px-[18mm] py-[16mm] shadow-sm"
      >
        {/* Masthead: brand lockup row over the title. */}
        <div className="flex items-end justify-between gap-6 border-b-2 border-border pb-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-md" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
        <Skeleton className="mt-4 h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />

        {/* The fact block. */}
        <div className="mt-4 flex flex-col gap-2 rounded-xs border border-border bg-muted/40 px-4 py-3">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>

        {/* Numbered sections: a heading rule then paragraph lines, twice —
            enough to promise "a document with sections", not its length. */}
        {[0, 1].map((section) => (
          <div key={section} className="mt-8 flex flex-col gap-2">
            <div className="border-b border-border pb-1">
              <Skeleton className="h-3.5 w-40" />
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
