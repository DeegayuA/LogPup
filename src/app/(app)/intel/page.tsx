import { Suspense, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

import { AmbientBackdrop } from '@/components/ui/ambient-backdrop'
import { PageHeader } from '@/components/ui/page-header'
import { getBriefing, getSignals } from '@/features/intel/actions'
import type { Signal } from '@/features/intel/signals'
import { AskPanel } from '@/features/intel/components/ask-panel'
import { BriefingCard } from '@/features/intel/components/briefing-card'
import { SignalBoard } from '@/features/intel/components/signal-board'
import {
  AskPanelSkeleton,
  BriefingCardSkeleton,
  SignalBoardSkeleton,
} from '@/features/intel/components/intel-skeletons'

export const metadata = { title: 'Intel' }

/**
 * Everything the watchdog noticed, in one place: a written briefing, the
 * ranked signals behind it, and a box to ask the same grounding pack anything
 * the three of them did not already answer.
 *
 * The page function is deliberately NOT async. It awaits nothing, so the
 * header, the backdrop and both region shells are in the first flush while
 * the reads behind them are still running — and the two boundaries below are
 * split by COST, not by layout. Signals are a batched database read; the
 * briefing is a Gemini call that can take seconds. Behind one shared boundary
 * the board would sit blank waiting on the model, which is the one thing on
 * this page that has to be readable immediately.
 */
/**
 * `ask` arrives from the command palette: a ⌘K search that found nothing
 * offers "Ask about '<query>'" and routes here rather than making the person
 * retype it. Capped at ASK_MAX_CHARS — the same ceiling askWorkspace's schema
 * enforces — and TRUNCATED rather than rejected, because a query that
 * overflows should still land as a question somebody can edit down, not as an
 * error page about a search they already typed.
 */
const ASK_MAX_CHARS = 500

export default async function IntelPage({
  searchParams,
}: {
  searchParams: Promise<{ ask?: string | string[] }>
}) {
  const { ask } = await searchParams
  // A repeated param arrives as an array. Take the first rather than joining:
  // ?ask=a&ask=b is a malformed link, and "ab" is a question nobody asked.
  const raw = Array.isArray(ask) ? ask[0] : ask
  const askedQuestion = (raw ?? '').trim().slice(0, ASK_MAX_CHARS)

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      <AmbientBackdrop />

      <PageHeader
        title="LogPup 🐾 Intel"
        description="What LogPup noticed across every app, sprint, meeting and work log — and a box for whatever it did not think to mention."
      />

      {/* The id lives on the SECTION, outside the boundary, so the palette's
          "Today's briefing" row scrolls to where the card is about to land
          rather than no-opping while it streams — same reason the dashboard
          puts #notifications on its skeleton. */}
      <section id="briefing" aria-label="Morning briefing" className="scroll-mt-6">
        <Suspense fallback={<BriefingCardSkeleton />}>
          <BriefingRegion />
        </Suspense>
      </section>

      {/* Suspense renders no DOM node of its own, so the fallback's two
          sections and the resolved two sections are grid children either way
          — the columns do not collapse and then reflow mid-stream. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
        <Suspense
          fallback={
            <>
              <SignalsSlot>
                <SignalBoardSkeleton />
              </SignalsSlot>
              <AskSlot>
                <AskPanelSkeleton />
              </AskSlot>
            </>
          }
        >
          <SignalsAndAsk askedQuestion={askedQuestion} />
        </Suspense>
      </div>
    </div>
  )
}

/**
 * The two grid cells, declared once and used by both the fallback and the
 * resolved output. Inlining them twice is how the anchor the palette links to
 * ends up on only one of the two states.
 */
function SignalsSlot({ children }: { children: ReactNode }) {
  return (
    <section id="signals" aria-label="LogPup signals" className="scroll-mt-6 min-w-0">
      {children}
    </section>
  )
}

function AskSlot({ children }: { children: ReactNode }) {
  return (
    <section
      id="ask"
      aria-label="Ask LogPup"
      className="scroll-mt-6 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar"
    >
      {children}
    </section>
  )
}

/**
 * The briefing, fetched on the server so the most prominent thing on the page
 * arrives as text rather than as an empty card the browser then fills.
 */
async function BriefingRegion() {
  const res = await getBriefing()
  if (!res.ok) {
    return (
      <RegionError title="No briefing this time">
        {res.error} The signals it would have been written from are below, and the ask box still
        works.
      </RegionError>
    )
  }
  return <BriefingCard initial={res.data} />
}

/**
 * Both lower regions, behind ONE read.
 *
 * The board renders the signals and the ask box's chips are derived from the
 * same list, so splitting these into two boundaries would mean two
 * `getSignals()` calls — a second full pass over tasks, follow-ups,
 * capacities, sprints, worklog gaps, meetings and apps for a handful of
 * suggestion strings.
 */
async function SignalsAndAsk({ askedQuestion }: { askedQuestion: string }) {
  const res = await getSignals()

  return (
    <>
      <SignalsSlot>
        {res.ok ? (
          <SignalBoard signals={res.data} />
        ) : (
          <RegionError title="The signals wouldn’t load">
            {res.error} Nothing here is lost — ask the box beside this for the same thing in words.
          </RegionError>
        )}
      </SignalsSlot>
      <AskSlot>
        {/* No suggestions when the read failed: the panel treats an empty
            list as "no chips" and the question box itself is unaffected, so a
            broken signals read costs the shortcuts and nothing else. */}
        <AskPanel
          suggestions={res.ok ? suggestQuestions(res.data) : []}
          initialQuestion={askedQuestion}
        />
      </AskSlot>
    </>
  )
}

/**
 * A failed region, in the shape features/bugs/components/bug-list.tsx uses:
 * named, announced, and printing the reason it was given rather than a shrug.
 * Scoped to the one region that failed — the other two on this page are
 * independent reads and keep working.
 */
function RegionError({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

/** Four chips is a row on a narrow column; more wraps into a wall. */
const MAX_SUGGESTIONS = 4

/**
 * The chips under the ask box, built from the signals actually on screen.
 *
 * Never a fixed list. A suggested question the workspace holds no rows for
 * spends a real Gemini call to answer "I don't have that", which teaches
 * people the box does not work — so every chip here corresponds to a signal
 * that actually fired, and the grounding pack behind the answer is the same
 * one the signal was ranked from.
 */
function suggestQuestions(signals: Signal[]): string[] {
  const questions: string[] = []
  for (const signal of signals) {
    const question = questionFor(signal)
    /* Signals arrive ranked, so the first of a kind is the most urgent one.
       Deduped on the QUESTION rather than the kind: capacity.over and
       capacity.near are two kinds asking the same thing, and so are two
       at-risk sprints once the name has been clipped away. */
    if (!questions.includes(question)) questions.push(question)
    if (questions.length === MAX_SUGGESTIONS) break
  }
  return questions
}

/**
 * Exhaustive over SignalKind on purpose: a kind added to the contract without
 * a question here is a compile error, not a signal that silently stops
 * offering one.
 */
function questionFor(signal: Signal): string {
  switch (signal.kind) {
    case 'task.overdue':
      return 'Which of my overdue tasks should I clear first?'
    case 'followup.stale':
      return 'Which follow-ups do I owe, and who is waiting on them?'
    case 'capacity.over':
    case 'capacity.near':
      return 'Who is carrying too much right now, and what could move off them?'
    case 'sprint.at-risk': {
      const name = sprintNameIn(signal.title)
      return name === null
        ? 'Which sprint is most at risk, and what would it take to land it?'
        : `Will ${name} land in time?`
    }
    case 'worklog.gap':
      return 'Which working days am I missing from my work log?'
    case 'meeting.unwritten':
      return 'Which meetings still need their notes written up?'
    case 'app.quiet':
      return 'Which apps have gone quiet, and what was last done on them?'
  }
}

/**
 * The sprint's own name, read back out of the signal title.
 *
 * signals.ts writes that title as "<name> may not land in time" or "<name>
 * ended with work open" — and clips the whole string at 60 characters, so a
 * long sprint name arrives with the suffix already cut off. Returning null
 * when neither tail is there is what keeps the failure harmless: the caller
 * asks the unnamed version of the question instead of pasting a whole
 * sentence into the middle of one. No date is quoted either, because a Signal
 * carries none — the grounding pack behind the answer does.
 */
function sprintNameIn(title: string): string | null {
  for (const tail of [' may not land in time', ' ended with work open']) {
    if (title.endsWith(tail)) return title.slice(0, -tail.length)
  }
  return null
}
