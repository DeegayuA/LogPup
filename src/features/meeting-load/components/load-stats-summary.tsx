import { Clock, Layers, Sparkles, TriangleAlert } from 'lucide-react'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import type { PerAppLoadRow, SeriesTableRow, WeeklyLoadRow } from '@/features/meeting-load/queries'

interface LoadStatsSummaryProps {
  weekly: WeeklyLoadRow[]
  perApp: PerAppLoadRow[]
  series: SeriesTableRow[]
}

export function LoadStatsSummary({ weekly, perApp, series }: LoadStatsSummaryProps) {
  const totalHours = Math.round(weekly.reduce((acc, r) => acc + r.invitedHours, 0))
  const totalMeetings = weekly.reduce((acc, r) => acc + r.meetingCount, 0)
  const avgHoursPerWeek = weekly.length > 0 ? (totalHours / weekly.length).toFixed(1) : '0'

  const overallCoverage =
    totalMeetings > 0
      ? Math.round((weekly.reduce((acc, r) => acc + r.coverage * r.meetingCount, 0) / totalMeetings) * 100)
      : 0

  const totalOverlapHours = weekly.reduce((acc, r) => acc + r.overlapHours, 0).toFixed(1)
  const totalNoAgenda = weekly.reduce((acc, r) => acc + r.noAgendaCount, 0)
  const projectCount = perApp.filter((p) => p.appId !== null).length

  const stats = [
    {
      label: 'Committed Meeting Load',
      value: `${totalHours}h`,
      meta: `Avg. ${avgHoursPerWeek}h/wk across ${weekly.length} weeks`,
      icon: Clock,
      badge: `${totalMeetings} meetings`,
      colorClass: 'text-primary',
      bgGlow: 'from-primary/15 via-primary/5 to-transparent',
      borderHover: 'hover:border-primary/50',
    },
    {
      label: 'Intelligence Coverage',
      value: `${overallCoverage}%`,
      meta: 'Audio transcribed & structured by AI',
      icon: Sparkles,
      badge: overallCoverage >= 70 ? 'Optimal' : 'Needs attention',
      badgeClass:
        overallCoverage >= 70
          ? 'bg-primary/10 text-primary border-primary/20'
          : 'bg-chart-1/10 text-chart-1 border-chart-1/20',
      colorClass: 'text-emerald-500 dark:text-emerald-400',
      bgGlow: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      borderHover: 'hover:border-emerald-500/50',
    },
    {
      label: 'Schedule Friction',
      value: `${totalOverlapHours}h`,
      meta: `${totalNoAgenda} meetings lacked an agenda`,
      icon: TriangleAlert,
      badge: Number(totalOverlapHours) > 0 ? 'Overlaps detected' : 'Clean schedule',
      badgeClass:
        Number(totalOverlapHours) > 0
          ? 'bg-chart-1/10 text-chart-1 border-chart-1/20'
          : 'bg-primary/10 text-primary border-primary/20',
      colorClass: 'text-chart-1',
      bgGlow: 'from-chart-1/15 via-chart-1/5 to-transparent',
      borderHover: 'hover:border-chart-1/50',
    },
    {
      label: 'Monitored Series',
      value: `${series.length}`,
      meta: `Distributed across ${projectCount} active projects`,
      icon: Layers,
      badge: 'Repeat patterns',
      colorClass: 'text-foreground',
      bgGlow: 'from-foreground/10 via-foreground/5 to-transparent',
      borderHover: 'hover:border-foreground/40',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <SpotlightCard
            key={stat.label}
            className={`group flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-card/60 p-4.5 shadow-xs backdrop-blur-md transition-all duration-200 ${stat.borderHover}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-tight text-muted-foreground">
                {stat.label}
              </span>
              <div
                className={`flex size-7 items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted ${stat.colorClass}`}
              >
                <Icon className="size-3.5" aria-hidden />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
                  {stat.value}
                </span>
                {stat.badge ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-2xs font-medium ${
                      stat.badgeClass ?? 'border-border/70 bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {stat.badge}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{stat.meta}</p>
            </div>
          </SpotlightCard>
        )
      })}
    </div>
  )
}
