import { AmbientBackdrop } from '@/components/ui/ambient-backdrop'
import {
  AskPanelSkeleton,
  BriefingCardSkeleton,
  SignalBoardSkeleton,
} from '@/features/intel/components/intel-skeletons'

/**
 * Cold entry into /intel only.
 *
 * Kept rather than left to the page's own <Suspense> boundaries, for the
 * reason people/history/loading.tsx states: a dynamic route with no
 * loading.tsx is not partially prefetchable AT ALL. Without this file the
 * Intel nav row silently loses hover prefetch — and the row sits in the
 * primary nav with a "G I" jump, which is exactly the traffic prefetch is for.
 *
 * Everything is shimmer here because on a cold load nothing real exists yet,
 * not even the header. Once the route is mounted the page renders its header,
 * backdrop and both region shells for real, and only the two skeletons below
 * stand in — see the Suspense split in page.tsx, which is by COST (a batched
 * read versus a Gemini call), not by layout.
 *
 * The skeletons are imported from the intel feature rather than redrawn here.
 * A second geometry is a second thing to keep true when a card changes, and
 * the drift lands where nobody looks: the cold-entry path.
 */
export default function LoadingStudioIntel() {
  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      <AmbientBackdrop />

      {/* Header stand-in. Matches PageHeader's h1 + description block so the
          real header does not shove the briefing down on hydration. */}
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-md bg-muted/60" />
      </div>

      <BriefingCardSkeleton />

      {/* Same track sizes as page.tsx, not an approximation: a cold load that
          reflows from two equal columns into a 1.65/1 split is the layout shift
          this file exists to prevent. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
        <SignalBoardSkeleton />
        <div className="lg:sticky lg:top-20 lg:self-start">
          <AskPanelSkeleton />
        </div>
      </div>
    </div>
  )
}
