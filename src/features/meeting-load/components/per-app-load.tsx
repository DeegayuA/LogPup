import { AppWindow, Building2, Info, PieChart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { PerAppLoadRow } from '@/features/meeting-load/queries'

/**
 * Where the hours went, by project.
 *
 * THE "NO APP" BUCKET IS A REAL ANSWER, not a rounding error: a company
 * all-hands belongs to nobody, and hiding its hours would understate the total
 * everybody is actually being invited to.
 */
export function PerAppLoad({ rows }: { rows: PerAppLoadRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 text-center backdrop-blur-sm">
        <PieChart className="size-8 text-muted-foreground/50" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">No project hours recorded</p>
        <p className="text-xs text-muted-foreground">
          Hours will appear here as meetings are tagged to active projects.
        </p>
      </div>
    )
  }

  const total = rows.reduce((sum, row) => sum + row.invitedHours, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Top summary row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-2xs">
            {rows.length} {rows.length === 1 ? 'Destination' : 'Destinations'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Ranked by total invited meeting hours
          </span>
        </div>
        <div className="font-mono text-xs font-semibold text-foreground">
          {Math.round(total)}h total logged
        </div>
      </div>

      {/* Ranked Project List */}
      <div className="flex flex-col gap-2.5">
        {rows.map((row, index) => {
          const isNoApp = row.appId === null
          const percentage = total === 0 ? 0 : (row.invitedHours / total) * 100

          return (
            <div
              key={row.appId ?? '__none__'}
              className="group relative flex flex-col gap-2 rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-2xs backdrop-blur-sm transition-all duration-150 hover:border-primary/40 hover:bg-card/90"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-lg font-mono text-2xs font-bold ${
                      index === 0
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : index === 1
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    #{index + 1}
                  </span>

                  <div className="flex min-w-0 items-center gap-2">
                    {isNoApp ? (
                      <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <AppWindow className="size-3.5 shrink-0 text-primary" aria-hidden />
                    )}
                    <span
                      className={`truncate text-sm font-medium ${
                        isNoApp ? 'text-muted-foreground italic' : 'text-foreground'
                      }`}
                    >
                      {row.appName}
                    </span>
                    {isNoApp ? (
                      <Badge variant="secondary" className="text-2xs font-normal">
                        Studio Wide
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {row.invitedHours.toFixed(1)}h
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Progress track */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  aria-hidden
                  className={`h-full rounded-full transition-all duration-300 ${
                    isNoApp
                      ? 'bg-muted-foreground/40'
                      : index === 0
                        ? 'bg-gradient-to-r from-primary to-emerald-400'
                        : index === 1
                          ? 'bg-gradient-to-r from-primary/80 to-primary/60'
                          : 'bg-primary/50'
                  }`}
                  style={{ width: `${Math.max(percentage, 1)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Explanatory callout */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-muted-foreground/70 mt-0.5" aria-hidden />
        <p className="leading-relaxed">
          Joint meetings are split equally across the projects they serve. Deleting a project
          automatically moves its past meetings into <strong className="text-foreground">“No app”</strong>,
          preserving the total hours team members were actually invited to.
        </p>
      </div>
    </div>
  )
}
