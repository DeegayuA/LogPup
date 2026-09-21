import { CalendarOff } from 'lucide-react'
import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { assignments } from '@/db/schema'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { ApprovalActions } from '@/features/admin/components/approval-actions'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { can, effectiveGrant, type Actor } from '@/features/auth/capabilities'
import { absenceKindLabel, exemptsWholeDay } from '@/features/worklog/absence-kinds'
import { canReviewAbsence, type AbsenceRow } from '@/features/worklog/absence-queries'

/**
 * `?view=list` — today's fifty-row table, lifted out of the page unchanged
 * in substance (see the old page.tsx diff): same fields, same "label, not
 * enum" reasoning, same part-day badge wording.
 *
 * The one real change: `canReview` is now decided PER ROW, against the
 * ABSENT PERSON's own apps, instead of the page-level `absence.approve`
 * check this page used to hoist above the loop — the exact scoped-grant-
 * fails-closed shape `canReviewAbsence`'s own comment (absence-queries.ts)
 * already fixed once for the pending-approvals queue and the calendar. This
 * view is a third caller of that SAME predicate, not a new one: the batched
 * assignments read below mirrors `listAbsencesForRange`
 * (absence-calendar-queries.ts) rather than re-deriving it, because
 * `listRecentAbsences` — which this view's data comes from, and which is not
 * edited — returns `AbsenceRow`, not `AbsenceCalendarRow`.
 */
export async function AbsenceListView({
  absences,
  actor,
}: {
  absences: AbsenceRow[]
  actor: Actor
}) {
  if (absences.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="No absences recorded."
        description="People file these from their work log. Approved ones exempt those days from coverage."
      />
    )
  }

  const approvesAll = can(actor, 'absence.approve')
  const approveGrant = effectiveGrant(actor.role, actor.employmentType, 'absence.approve')

  // Paid only for the 'scoped' case (manager) — 'all' (admin+) already
  // answers true with no appIds, 'none' already answers false with none
  // either, same short-circuit as listAbsencesForRange.
  const appIdsByUser = new Map<string, string[]>()
  if (!approvesAll && approveGrant !== 'none') {
    const otherUserIds = [...new Set(absences.filter((a) => a.userId !== actor.id).map((a) => a.userId))]
    if (otherUserIds.length > 0) {
      const memberships = await db
        .select({ userId: assignments.userId, appId: assignments.appId })
        .from(assignments)
        .where(inArray(assignments.userId, otherUserIds))
      for (const m of memberships) {
        const list = appIdsByUser.get(m.userId)
        if (list) list.push(m.appId)
        else appIdsByUser.set(m.userId, [m.appId])
      }
    }
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {absences.map((a) => {
        const pending = a.status === 'pending'
        const canReview =
          a.userId === actor.id
            ? can(actor, 'request.review.self', { ownerId: actor.id })
            : canReviewAbsence(actor, { userId: a.userId, appIds: appIdsByUser.get(a.userId) ?? [] })
        return (
          <li key={a.id} className="flex flex-col gap-1.5 py-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <span className="font-medium">{a.userName}</span>
              {/* THE LABEL, NOT THE ENUM. This printed `other_project` and
                  `no_work_assigned` at whoever had to decide on it, and the
                  vocabulary has since grown to fourteen kinds —
                  `short_leave` and `half_day` among them. An approver who
                  cannot tell a half day from annual leave at a glance is
                  being asked to approve a string. */}
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{absenceKindLabel(a.kind)}</span>
                {!exemptsWholeDay(a.kind) ? (
                  <span className="ml-1.5 rounded bg-muted px-1 py-px font-mono text-2xs">
                    part day — still owes a log
                  </span>
                ) : null}
                <span className="ml-1.5 font-mono tabular-nums">
                  {a.startDate}
                  {a.endDate !== a.startDate && ` to ${a.endDate}`} · {a.status}
                </span>
              </span>
            </div>
            {a.reason ? (
              <span className={cn(bilingualText, 'text-xs text-muted-foreground')}>{a.reason}</span>
            ) : null}
            {pending && canReview ? (
              <ApprovalActions id={a.id} kind="absence" isSelf={a.userId === actor.id} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
