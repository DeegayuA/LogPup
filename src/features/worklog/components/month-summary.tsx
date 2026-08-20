import { Flame, Target, CheckCircle2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The month in four performance cards: Expected working days, Logged entries,
 * Coverage percentage, and current Streak.
 *
 * Purely presentational; inputs are computed upstream via computeCoverage.
 */

const num = (n: number) => String(Math.round(n * 10) / 10)

export function MonthSummary({
  monthLabel,
  expected,
  loggedCount,
  coveragePct,
  coverageDetail,
  streak,
}: {
  monthLabel: string
  expected: number
  loggedCount: number
  coveragePct: number | null
  coverageDetail: string
  streak: number
}) {
  const isHealthyCoverage = coveragePct !== null && coveragePct >= 75
  const isAttentionCoverage = coveragePct !== null && coveragePct < 60

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* 1. Expected Days */}
      <div className="group flex flex-col justify-between gap-2 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-card">
        <div className="flex items-center justify-between">
          <span className="font-heading text-xs font-semibold text-muted-foreground">
            Expected in {monthLabel}
          </span>
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target className="size-4" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {num(expected)}
          </span>
          <span className="font-mono text-2xs text-muted-foreground">days</span>
        </div>
        <p className="text-2xs text-muted-foreground line-clamp-1">
          Working days after holidays &amp; leave
        </p>
      </div>

      {/* 2. Logged Days */}
      <div className="group flex flex-col justify-between gap-2 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-sm transition-all duration-200 hover:border-primary/50 hover:bg-card">
        <div className="flex items-center justify-between">
          <span className="font-heading text-xs font-semibold text-muted-foreground">
            Logged Entries
          </span>
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CheckCircle2 className="size-4" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {loggedCount}
          </span>
          <span className="font-mono text-2xs text-muted-foreground">
            {loggedCount === 1 ? 'day recorded' : 'days recorded'}
          </span>
        </div>
        {/* Micro progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, Math.round((loggedCount / (expected || 1)) * 100))}%` }}
          />
        </div>
      </div>

      {/* 3. Coverage */}
      <div
        className={cn(
          'group flex flex-col justify-between gap-2 rounded-2xl border p-4 shadow-xs backdrop-blur-sm transition-all duration-200',
          isAttentionCoverage
            ? 'border-chart-1/40 bg-chart-1/5'
            : isHealthyCoverage
              ? 'border-primary/40 bg-primary/5'
              : 'border-border/70 bg-card/60',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="font-heading text-xs font-semibold text-muted-foreground">
            Coverage So Far
          </span>
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              isAttentionCoverage
                ? 'bg-chart-1/15 text-chart-1'
                : 'bg-primary/10 text-primary',
            )}
          >
            <TrendingUp className="size-4" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'font-mono text-2xl font-bold tabular-nums',
              isAttentionCoverage ? 'text-chart-1' : isHealthyCoverage ? 'text-primary' : 'text-foreground',
            )}
          >
            {coveragePct === null ? '—' : `${coveragePct}%`}
          </span>
        </div>
        <p className="text-2xs text-muted-foreground line-clamp-1">
          {coverageDetail}
        </p>
      </div>

      {/* 4. Streak */}
      <div
        className={cn(
          'group flex flex-col justify-between gap-2 rounded-2xl border p-4 shadow-xs backdrop-blur-sm transition-all duration-200',
          streak >= 3
            ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card/80 to-card/60'
            : 'border-border/70 bg-card/60',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="font-heading text-xs font-semibold text-muted-foreground">
            Active Streak
          </span>
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              streak > 0 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <Flame className={cn('size-4', streak >= 3 && 'animate-pulse text-primary')} />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {streak}
          </span>
          <span className="font-mono text-2xs text-muted-foreground">
            {streak === 1 ? 'consecutive day' : 'consecutive days'}
          </span>
        </div>
        <p className="text-2xs text-muted-foreground line-clamp-1">
          {streak === 0
            ? 'Log today to start your streak'
            : streak >= 5
              ? '🔥 Phenomenal velocity!'
              : 'Keep the momentum going!'}
        </p>
      </div>
    </div>
  )
}
