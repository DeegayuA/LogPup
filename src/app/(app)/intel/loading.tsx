import { AmbientBackdrop } from '@/components/ui/ambient-backdrop'
import { PageHeader } from '@/components/ui/page-header'
import {
  AskPanelSkeleton,
  BriefingCardSkeleton,
  SignalBoardSkeleton,
} from '@/features/intel/components/intel-skeletons'

/**
 * Cold entry into /intel only — later visits stream through the page's own
 * two <Suspense> boundaries.
 *
 * It exists because loading.js is the nearest ANCESTOR segment's boundary
 * when a route declares none (see
 * node_modules/next/dist/docs/01-app/02-guides/streaming.md), so without this
 * file /intel inherited src/app/(app)/loading.tsx — and navigating to Intel
 * painted "Studio Dashboard", announced "Loading dashboard…" to a screen
 * reader, and drew the four dashboard zones before swapping to a two-column
 * layout that shares none of their geometry. That is the "skeleton that lies
 * about the coming layout" the dashboard's own loading.tsx warns against.
 *
 * The header is rendered FOR REAL: both strings are constants, not session
 * or query dependent, so there is nothing here to shimmer. Everything else
 * comes from the same intel-skeletons module the page's fallbacks use, inside
 * the same shell and the same grid — the two cannot drift apart.
 */
export default function LoadingIntel() {
  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      <AmbientBackdrop />

      <PageHeader
        title="Studio Intel"
        description="What LogPup noticed across every app, sprint, meeting and work log — and a box for whatever it did not think to mention."
      />

      <section id="briefing" aria-label="Morning briefing" className="scroll-mt-6">
        <BriefingCardSkeleton />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
        <section id="signals" aria-label="Studio signals" className="scroll-mt-6">
          <SignalBoardSkeleton />
        </section>
        <section id="ask" aria-label="Ask LogPup" className="scroll-mt-6">
          <AskPanelSkeleton />
        </section>
      </div>
    </div>
  )
}
