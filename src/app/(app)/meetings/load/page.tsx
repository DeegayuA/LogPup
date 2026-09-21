import { Suspense } from 'react'
import Link from 'next/link'
import {
  AppWindow,
  ArrowLeft,
  Calendar,
  Repeat,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listApps } from '@/features/apps/queries'
import { getPerAppLoad, getSeriesTable, getWeeklyLoadTable } from '@/features/meeting-load/queries'
import { LoadStatsSummary } from '@/features/meeting-load/components/load-stats-summary'
import { PerAppLoad } from '@/features/meeting-load/components/per-app-load'
import { SeriesLoadTable } from '@/features/meeting-load/components/series-load-table'
import { WeeklyLoadTable } from '@/features/meeting-load/components/weekly-load-table'
import { listActiveUsers } from '@/features/people/queries'
import { getMeetingLoadSuggestions } from '@/features/meetings/load-actions'
import { LoadBoard } from '@/features/meetings/components/load-board'

export const metadata = { title: 'Meeting Load Intelligence — LogPup' }

/**
 * The suggestion queue and audit engine for meeting load.
 *
 * SUSPENSE-SPLIT: The header is static and renders immediately.
 * The suggestion queue (Board) and 6-month historical audit sweeps (Audit)
 * load in parallel with polished skeleton placeholders.
 */
export default function MeetingLoadPage() {
  return (
    <div className="relative flex flex-1 flex-col gap-8 p-6 md:p-8 lg:p-10">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[500px] w-[650px] rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 left-10 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/8 blur-3xl"
        aria-hidden
      />

      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-border/70 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-2xs font-semibold text-primary">
                <Sparkles className="size-3" aria-hidden />
                Load Intelligence
              </span>
              <span className="font-mono text-2xs text-muted-foreground">
                Six-month analytical window
              </span>
            </div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Meeting Load &amp; Capacity
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Hours committed on calendars, not hours spent in rooms. Every suggestion is a question
              designed to eliminate schedule fragmentation without touching attendance records on its own.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 cursor-pointer shadow-2xs"
              render={<Link href="/meetings" />}
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to meetings
            </Button>
          </div>
        </div>
      </div>

      {/* Tier 1: Actionable Suggestions Board */}
      <section className="flex flex-col gap-3">
        <Suspense fallback={<BoardSkeleton />}>
          <Board />
        </Suspense>
      </section>

      {/* Tier 2: Studio Meeting Audit & Analytics */}
      <section className="flex flex-col gap-6">
        <Suspense fallback={<TablesSkeleton />}>
          <Audit />
        </Suspense>
      </section>
    </div>
  )
}

async function Board() {
  const [result, apps, activeUsers] = await Promise.all([
    getMeetingLoadSuggestions(),
    listApps(),
    listActiveUsers(),
  ])

  if (!result.ok) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border/80 bg-card/40 p-6 backdrop-blur-sm">
        <p className="inline-flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
          <TriangleAlert aria-hidden className="size-4 text-chart-1" />
          {result.error}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These cards analyze open work across all studio projects simultaneously to uncover
          slot consolidations, and require project lead permissions to view.
        </p>
      </div>
    )
  }

  return (
    <LoadBoard
      suggestions={result.data.suggestions}
      apps={apps.map((app) => ({ id: app.id, name: app.name }))}
      activeUsers={activeUsers}
      dismissedCount={result.data.dismissedCount}
    />
  )
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {[0, 1].map((card) => (
        <div
          key={card}
          className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-36 rounded-full" />
              <Skeleton className="h-6 w-96" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Skeleton className="h-28 rounded-xl lg:col-span-7" />
            <Skeleton className="h-28 rounded-xl lg:col-span-5" />
          </div>
          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

async function Audit() {
  const now = new Date()
  const [weekly, perApp, series] = await Promise.all([
    getWeeklyLoadTable(now),
    getPerAppLoad(now),
    getSeriesTable(now),
  ])

  return (
    <div className="flex flex-col gap-8">
      {/* Executive KPI Stat Ribbon */}
      <LoadStatsSummary weekly={weekly} perApp={perApp} series={series} />

      {/* Tabbed Audit Hub */}
      <Tabs defaultValue="weekly" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-3.5">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-heading text-base font-bold tracking-tight text-foreground">
              Studio Audit &amp; Trends
            </h2>
            <p className="text-2xs text-muted-foreground">
              Examine aggregate historical trends, destination projects, and recurring meeting hygiene.
            </p>
          </div>

          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="weekly" className="gap-1.5 text-xs cursor-pointer">
              <Calendar className="size-3.5" aria-hidden />
              Week by Week ({weekly.length})
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5 text-xs cursor-pointer">
              <AppWindow className="size-3.5" aria-hidden />
              By Project ({perApp.length})
            </TabsTrigger>
            <TabsTrigger value="series" className="gap-1.5 text-xs cursor-pointer">
              <Repeat className="size-3.5" aria-hidden />
              Recurring Series ({series.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="weekly" className="flex flex-col gap-3 outline-none">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Twelve-Week Historical Load
            </h3>
            <p className="text-2xs text-muted-foreground">
              Scheduled hours, recording density, and double-booking collision hours week by week.
            </p>
          </div>
          <WeeklyLoadTable rows={weekly} />
        </TabsContent>

        <TabsContent value="projects" className="flex flex-col gap-3 outline-none">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Project Distribution
            </h3>
            <p className="text-2xs text-muted-foreground">
              Where meeting hours are directed across apps and studio-wide sessions.
            </p>
          </div>
          <PerAppLoad rows={perApp} />
        </TabsContent>

        <TabsContent value="series" className="flex flex-col gap-3 outline-none">
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Inferred Recurring Series
            </h3>
            <p className="text-2xs text-muted-foreground">
              Stability, output yield, and speech participation across repeating meeting patterns.
            </p>
          </div>
          <SeriesLoadTable rows={series} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TablesSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      {/* Stat Ribbon Skeleton */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/60 p-4.5"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-72 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  )
}
