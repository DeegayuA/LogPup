import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Sparkles,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HeroShowcase } from './hero-showcase'
import { BentoFeatures } from './bento-features'
import { CapabilitiesGrid } from './capabilities-grid'
import { OpsMetricsStrip } from './ops-metrics-strip'
import { ScopeNotice } from './scope-notice'
import { PlateBriefing, PlateCapacity, PlateWriteup } from './plates'
import { MouseFollower } from './mouse-follower'

export const metadata: Metadata = {
  // `absolute` rather than a plain string: the root layout sets
  // template: "%s · LogPup", which a bare string opts into, and this title
  // already opens with the product name — so the tab and the SERP entry would
  // both read "LogPup — … · LogPup". Google's brand verification compares this
  // against the name on the consent screen, and a doubled mark is exactly the
  // inconsistency that check exists to catch.
  title: { absolute: 'LogPup — engineering ops for Alta Vision teams' },
  description:
    'LogPup tracks the apps a studio runs, who works on them, what each team ships this sprint, and what happened in every meeting with Gemini AI transcription.',
}

export default function PublicHomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Custom fluid mouse hover & pointer animation for home page */}
      <MouseFollower />

      {/* Background ambient lighting effects */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-[800px] -right-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-[1600px] -left-40 -z-10 h-[450px] w-[500px] rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[76rem] px-6 py-12 md:px-10 md:py-16">
        {/* ========================================================================= */}
        {/* §01 — HERO HEADER & SIDE-BY-SIDE INTERACTIVE OPS SHOWCASE                 */}
        {/* ========================================================================= */}
        <section className="relative">
          {/* `items-start`, not `items-center`. Centring a 700px column
              against a 1400px one pushed the product name and the primary
              call to action roughly 670px down the page — the two things a
              first-time visitor needs were below the fold while a sandbox
              they cannot use yet sat above it. Both columns now begin at the
              same line, which is also what makes the height cap on the right
              read as a deliberate frame rather than a truncation. */}
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            {/* Left Column: Headline, Description & CTAs (5 Cols) */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              {/* Studio Ops Badge */}
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary shadow-xs backdrop-blur-sm">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Alta Vision Internal Operations System</span>
              </div>

              {/* Exact H1 required for Google OAuth verification */}
              <h1 className="font-heading text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-5.5xl leading-[1.1]">
                LogPup
              </h1>

              <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                The central operational nervous system for engineering teams at Alta Vision.
                Track what is being built, who is overloaded, sprint velocity, and AI-transcribed meeting intelligence in one unified studio ledger.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'group h-11 px-6 text-sm font-semibold shadow-md transition-all duration-200 hover:shadow-primary/25 hover:shadow-lg',
                  )}
                >
                  Sign in with Google
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/privacy"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'h-11 border-border/80 px-5 text-sm font-medium hover:bg-muted/60',
                  )}
                >
                  Security &amp; Privacy
                </Link>
              </div>

              {/* Security & Access Sub-text */}
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <Lock className="size-3.5 text-primary" />
                <span>Restricted to authorized <strong className="text-foreground">@altavision.lk</strong> workspace accounts</span>
              </div>

              {/* Studio Ops Quick Value Highlights */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-2xs text-muted-foreground">
                <span className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 font-mono font-medium text-foreground">
                  <Sparkles className="size-3 text-primary" /> Gemini 3.6/3.7 Flagship AI
                </span>
                <span className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 font-mono font-medium text-foreground">
                  🇱🇰 Sri Lanka Calendar Engine
                </span>
                <span className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 font-mono font-medium text-foreground">
                  🛡️ 80% / 100% Burnout Radar
                </span>
              </div>
            </div>

            {/* Right Column: Hero Live Interactive Ops Preview (7 Cols) */}
            {/* HEIGHT-CAPPED, SCROLLING INSIDE ITSELF ON LARGE SCREENS.
                The sandbox stacks a tab bar and up to six blocks; uncapped it
                ran past 1400px and made the first screen of a marketing page
                taller than two viewports, while the left column finished ~570px
                earlier. Capping to the viewport minus the sticky header holds
                the hero to one screen and lets the panel scroll its own
                overflow — which suits a sandbox of a product that scrolls.

                `svh` not `vh`: mobile browser chrome resizes the viewport as
                you scroll, and `vh` would leave the panel taller than the space
                it was given. Deliberately lg-only — below that the columns are
                stacked, so there is no imbalance to correct, and a nested
                scroll inside a page scroll means you swipe and the wrong thing
                moves. */}
            <div className="lg:col-span-7 lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
              {/* Rates are resolved HERE, on the server, and handed down as one instant.
                  hero-showcase.tsx is a client component, so a `new Date()` at its
                  module scope would evaluate at build time on the server AND at load
                  time in the browser — agreeing today, disagreeing the moment a
                  promotional rate rolls over, as a hydration mismatch on a number the
                  page states as fact. */}
              <HeroShowcase pricedAt={new Date().toISOString()} />
            </div>
          </div>
        </section>

        {/* Live Interactive Metrics & Gemini Multi-Model Strip */}
        <OpsMetricsStrip />

        {/* ========================================================================= */}
        {/* §02 — BENTO GRID: 6 CORE FEATURE PILLARS                                  */}
        {/* ========================================================================= */}
        <section className="mt-24">
          <div className="mb-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 font-mono text-2xs font-bold uppercase tracking-widest text-primary">
              <Sparkles className="size-3 text-primary" />
              Built for Engineering Ops
            </div>
            <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-4.5xl leading-[1.15]">
              Everything your engineering studio needs to{' '}
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-chart-1 bg-clip-text text-transparent">
                ship with clarity.
              </span>
            </h2>
            <p className="mt-3.5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Eliminate disconnected status updates, lost meeting decisions, and hidden burnout.
              LogPup connects your codebases, sprints, and people into a single transparent workflow.
            </p>
          </div>

          <BentoFeatures />
        </section>

        {/* ========================================================================= */}
        {/* §03 — SAMPLE PLATES: ACTUAL DATA RECONSTRUCTIONS                          */}
        {/* ========================================================================= */}
        <section className="mt-28">
          <div className="mb-12 border-b border-border/70 pb-6">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
              Verified Production Architecture
            </span>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Real Data Surfaces &bull; Live Schemas
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Direct rendering of LogPup&apos;s daily operational records from active sprints, capacity baselines, and meeting journals.
            </p>
          </div>

          <div className="flex flex-col gap-20">
            {/* Plate I: Daily Briefing */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-muted-foreground uppercase">
                  Plate I &bull; Morning Ops Briefing
                </span>
                <span className="font-mono text-2xs text-primary">Live State Machine</span>
              </div>
              <PlateBriefing />
            </div>

            {/* Plate II: People & Capacity */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-muted-foreground uppercase">
                  Plate II &bull; Allocation &amp; Burnout Protection
                </span>
                <span className="font-mono text-2xs text-chart-1">112% Threshold Split</span>
              </div>
              <PlateCapacity />
            </div>

            {/* Plate III: Writeup & Action Items */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-muted-foreground uppercase">
                  Plate III &bull; Gemini AI Meeting Transcript &amp; Decisions
                </span>
                <span className="font-mono text-2xs text-primary">English + Sinhala Support</span>
              </div>
              <PlateWriteup />
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* §04 — 10 CORE CAPABILITIES GRID                                           */}
        {/* ========================================================================= */}
        <section className="mt-28">
          <div className="mb-10 max-w-2xl">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
              Complete System Spec
            </span>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              10 Pillars of Studio Operations
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Every tool and integration is purposefully designed for modern software development squads.
            </p>
          </div>

          <CapabilitiesGrid />
        </section>

        {/* ========================================================================= */}
        {/* §05 — GOOGLE OAUTH CALENDAR SCOPE COMPLIANCE                              */}
        {/* ========================================================================= */}
        <section className="mt-28">
          <ScopeNotice />
        </section>

        {/* ========================================================================= */}
        {/* §06 — SECURITY & OPERATIONAL COMMITMENT                                   */}
        {/* ========================================================================= */}
        <section className="mt-24 rounded-2xl border border-border/80 bg-muted/20 p-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs font-bold uppercase text-primary">Zero Commercial SaaS</span>
              <h3 className="font-heading text-lg font-bold text-foreground">Internal Studio Only</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                LogPup is not sold or opened to third-party organizations. All operational records, meeting audio, and capacity data remain strictly internal.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs font-bold uppercase text-primary">Encrypted Infrastructure</span>
              <h3 className="font-heading text-lg font-bold text-foreground">Zero Retention Audio</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Gemini audio processing is transient with zero model training retention. Database storage is encrypted with server-enforced role access controls.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs font-bold uppercase text-primary">Strict Scope Guard</span>
              <h3 className="font-heading text-lg font-bold text-foreground">Read-Only Calendar</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Google Calendar integration is strictly utilized to read schedule event metadata. LogPup never alters or writes external events.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* §07 — CALL TO ACTION BANNER                                               */}
        {/* ========================================================================= */}
        <section className="mt-24 mb-10 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-background p-8 md:p-12 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl flex flex-col gap-3">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 font-mono text-2xs font-bold uppercase text-primary">
                Authorized Access
              </span>
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Ready to check your studio ops?
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sign in with your approved Google Workspace account or administrator-issued passkey.
                New sign-ins are placed in a secure review queue until activated by an Alta Vision administrator.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/sign-in"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'h-12 px-8 text-sm font-semibold shadow-md',
                )}
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
