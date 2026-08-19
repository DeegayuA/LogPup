import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listRecentAbsences } from '@/features/worklog/absence-queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

export default async function AdminAbsencesPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'absence.view')) notFound()

  const absences = await listRecentAbsences(actor)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Absences</CardTitle>
        <CardDescription>
          Leave, training, and days spent on another project. An approved absence makes
          those days exempt, so they never count against coverage — and a day the person
          logged anyway still counts as work, not leave.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {absences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No absences recorded. People file these from their work log.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {absences.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                <span className="font-medium">{a.userName}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {a.kind} · {a.startDate}
                  {a.endDate !== a.startDate && ` to ${a.endDate}`} · {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
