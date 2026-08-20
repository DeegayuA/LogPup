'use client'

import {
  Users,
  Sparkles,
  Command,
  Kanban,
  Layers,
  CalendarCheck2,
  Search,
  Zap,
} from 'lucide-react'
import { Fortnight } from './fortnight'
import { SpotlightCard } from './spotlight-card'

export function BentoFeatures() {
  const activeCommand = 'Nuwan'

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {/* 1. Team Capacity & Burnout Radar */}
      <SpotlightCard
        spotlightColor="rgba(16, 185, 129, 0.15)"
        className="group relative rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-xl md:col-span-2"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Users className="size-4" /> Capacity & Burnout Radar
        </div>
        <h3 className="mt-2 font-heading text-xl font-bold tracking-tight text-foreground md:text-2xl">
          The bar goes amber before anyone burns out.
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Allocation is a precise number per person across every studio app. &ldquo;They&apos;re fine&rdquo; becomes 86%.
          Thresholds at 80% switch to amber alerts, while overallocations past 100% split into an isolated red overflow segment.
        </p>

        {/* Visual demo */}
        <div className="mt-6 rounded-xl border border-border/60 bg-muted/30 p-4 transition-transform duration-200 group-hover:translate-y-[-2px]">
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Nuwan Perera</span>
                <span className="font-mono text-2xs text-muted-foreground">Lead Eng</span>
              </div>
              <span className="font-mono font-medium text-destructive">112% (Over capacity)</span>
            </div>
            <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-destructive rounded-full" style={{ width: '89%' }} />
              <div className="h-full bg-destructive/40 rounded-full" style={{ width: '11%' }} />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Ishara Fernando</span>
                <span className="font-mono text-2xs text-muted-foreground">Sr Eng</span>
              </div>
              <span className="font-mono font-medium text-chart-1">86% (Near capacity)</span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-chart-1 rounded-full" style={{ width: '86%' }} />
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* 2. Gemini AI Meeting Intelligence */}
      <SpotlightCard
        spotlightColor="rgba(245, 158, 11, 0.15)"
        className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-chart-1/50 hover:shadow-xl"
      >
        <div className="pointer-events-none absolute -right-12 -bottom-12 size-36 rounded-full bg-chart-1/10 blur-xl group-hover:bg-chart-1/20 transition-all" />
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-chart-1">
            <Sparkles className="size-4" /> Meeting Intelligence
          </div>
          <h3 className="mt-2 font-heading text-xl font-bold tracking-tight text-foreground">
            Bilingual Notes & Action Items
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Record in the browser (mic or screen). Google Gemini transcribes in real-time with dual-language
            English &amp; Sinhala (<span lang="si">සිංහල</span>) extraction, assigning action items and deadlines.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs transition-transform duration-200 group-hover:translate-y-[-2px]">
          <div className="font-mono text-2xs uppercase text-primary font-semibold flex items-center gap-1.5">
            <Zap className="size-3" /> Sinhala AI Summary
          </div>
          <p className="mt-1 font-medium text-foreground leading-snug" lang="si">
            ඊළඟ sprint එකට කලින් migration journal එක සම්පූර්ණ කළ යුතුය.
          </p>
          <div className="mt-2 flex items-center gap-2 text-2xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> Audio is never stored — text transcript only.
          </div>
        </div>
      </SpotlightCard>

      {/* 3. ⌘K Universal Command Center */}
      <SpotlightCard
        spotlightColor="rgba(16, 185, 129, 0.15)"
        className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-xl"
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Command className="size-4" /> Command Center
          </div>
          <h3 className="mt-2 font-heading text-xl font-bold tracking-tight text-foreground">
            Universal ⌘K Spotlight
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Jump to any app, engineer, sprint task, meeting, or theme preference in &le;3 keystrokes with Spotlight-style speed.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-transform duration-200 group-hover:translate-y-[-2px]">
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Search className="size-3.5 text-primary" />
            <span className="text-foreground font-medium">{activeCommand}</span>
            <span className="ml-auto font-mono text-2xs rounded bg-card px-1 border border-border">⌘K</span>
          </div>
          <div className="mt-2 flex flex-col gap-1 text-2xs">
            <div className="flex items-center justify-between rounded p-1.5 bg-primary/10 text-foreground font-medium">
              <span>👤 Nuwan Perera &bull; Lead Engineer</span>
              <span className="font-mono text-muted-foreground">Jump</span>
            </div>
            <div className="flex items-center justify-between rounded p-1.5 text-muted-foreground hover:bg-muted/40">
              <span>⚡ Task: Unblock migration journal</span>
              <span className="font-mono">Kestrel</span>
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* 4. Direct-Manipulation Sprint Kanban */}
      <SpotlightCard
        spotlightColor="rgba(16, 185, 129, 0.15)"
        className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-xl"
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Kanban className="size-4" /> Sprint Boards
          </div>
          <h3 className="mt-2 font-heading text-xl font-bold tracking-tight text-foreground">
            Kanban with Role Guards
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Drag-and-drop workflow with optimistic client updates, server-enforced role permissions, and seamless 1-way Notion export.
          </p>
        </div>

        <div className="mt-5 flex gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 transition-transform duration-200 group-hover:translate-y-[-2px]">
          <div className="flex-1 rounded-lg bg-card p-2 text-2xs border border-border/40">
            <div className="font-semibold text-primary">In Progress</div>
            <div className="mt-1.5 rounded bg-muted/60 p-1.5 font-medium text-foreground">
              PKCE OAuth Guard
            </div>
          </div>
          <div className="flex-1 rounded-lg bg-card/80 p-2 text-2xs border border-border/40">
            <div className="font-semibold text-muted-foreground">Done</div>
            <div className="mt-1.5 rounded bg-muted/30 p-1.5 line-through text-muted-foreground">
              Rate Limit Redesign
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* 5. Studio App Portfolio */}
      <SpotlightCard
        spotlightColor="rgba(16, 185, 129, 0.15)"
        className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-xl"
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Layers className="size-4" /> App Portfolio
          </div>
          <h3 className="mt-2 font-heading text-xl font-bold tracking-tight text-foreground">
            Every Product in Flight
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Complete technical specs, stack tags, repository links, leads, sprint progress, and member health in one dashboard.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-border/60 bg-muted/30 p-3 transition-transform duration-200 group-hover:translate-y-[-2px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-xs">Kestrel Studio App</span>
            <span className="font-mono text-2xs text-primary font-medium">Sprint 14</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">Next.js 16</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">Neon Postgres</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">Gemini 2.5</span>
          </div>
        </div>
      </SpotlightCard>

      {/* 6. Studio Calendar & Work Log */}
      <SpotlightCard
        spotlightColor="rgba(16, 185, 129, 0.12)"
        className="group relative rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-xl md:col-span-2 lg:col-span-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <CalendarCheck2 className="size-4" /> Studio Calendar &amp; Work Log
            </div>
            <h3 className="mt-1.5 font-heading text-xl font-bold tracking-tight text-foreground md:text-2xl">
              Sri Lanka Studio Calendar &amp; Daily Work Ledger
            </h3>
          </div>
          <span className="font-mono text-2xs rounded-full bg-primary/10 text-primary px-3 py-1 font-medium">
            Sri Lanka Calendar Aware &bull; Asia/Colombo
          </span>
        </div>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Interactive full-month calendar and fortnight ledger. Saturdays are recognized as 50% half-days,
          gazetted Sri Lankan Poya holidays and Sundays are accounted as official days off, and today&apos;s log stays open until the day concludes.
        </p>

        <div className="mt-6 w-full">
          <Fortnight />
        </div>
      </SpotlightCard>
    </div>
  )
}
