import type { PerAppLoadRow } from '@/features/meeting-load/queries'

/**
 * Where the hours went, by project.
 *
 * THE "NO APP" BUCKET IS A REAL ANSWER, not a rounding error: a company
 * all-hands belongs to nobody, and hiding its hours would understate the total
 * everybody is actually being invited to. The caveat below it is printed rather
 * than left to be discovered — a project's meetings move into this bucket when
 * the project is deleted, so the bucket can grow for a reason that has nothing
 * to do with how anybody is scheduling.
 */
export function PerAppLoad({ rows }: { rows: PerAppLoadRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No project could be resolved yet.</p>
  }

  const total = rows.reduce((sum, row) => sum + row.invitedHours, 0)

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.appId ?? '__none__'} className="flex items-center gap-3 text-sm">
            <span className="min-w-32 shrink-0 truncate">{row.appName}</span>
            <span
              aria-hidden
              className="h-1.5 rounded-full bg-chart-1/70"
              style={{ width: `${total === 0 ? 0 : (row.invitedHours / total) * 100}%` }}
            />
            <span className="ml-auto tabular-nums text-muted-foreground">
              {Math.round(row.invitedHours)}h
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Deleting a project moves its past meetings into “No app”, so this bucket can grow
        without anybody scheduling differently.
      </p>
    </div>
  )
}
