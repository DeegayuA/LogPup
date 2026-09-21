'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ApprovalActions } from '@/features/admin/components/approval-actions'
import { bilingualText } from '@/features/meetings/components/meeting-chips'
import { absenceKindLabel, exemptsWholeDay } from '@/features/worklog/absence-kinds'
import type { AbsenceCalendarRow } from '@/features/worklog/absence-calendar-queries'

/**
 * `?day=YYYY-MM-DD`'s right-side sheet — the `meeting-intel-sheet.tsx`
 * pattern: a `Dialog` overriding the kit's centred-card geometry into a
 * fixed right panel, full-screen below `lg`. Mounted ONLY while the page has
 * a `day` prop (the caller's job), so `open` is always true here — closing
 * (Esc / X / backdrop) is the one thing this component does with it: write
 * the URL back to `closeHref`.
 *
 * ALL FOUR STATUSES, unlike the grid — see the page-level comment on why a
 * rejected filing still belongs in the sheet even though it never painted a
 * cell. `rows` arrives pre-sorted (pending first, then start date, then
 * name) by `dayAbsences` — this component does not re-sort.
 */
export function AbsenceDayPanel({
  day,
  rows,
  actorId,
  closeHref,
}: {
  day: string
  rows: AbsenceCalendarRow[]
  actorId: string
  closeHref: string
}) {
  const router = useRouter()

  function close() {
    // ponytail: focus return to the originating grid cell relies on the
    // browser's own post-navigation focus (document.body) rather than a
    // stored ref — meeting-intel-sheet.tsx can do better because its sheet
    // toggles client-side state instead of a URL param. Upgrade if a
    // keyboard-only regression report names this page.
    router.replace(closeHref, { scroll: false })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton
        className={
          'fixed inset-y-0 right-0 left-0 h-auto max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none shadow-lg sm:max-w-none lg:left-auto lg:w-[min(560px,92vw)] ' +
          'flex flex-col gap-0 overflow-y-auto p-0 ' +
          'duration-(--dur-base) ease-(--ease-enter) data-closed:duration-(--dur-quick) data-closed:ease-(--ease-exit) data-open:zoom-in-100 data-closed:zoom-out-100 data-open:slide-in-from-right-full data-closed:slide-out-to-right-full motion-reduce:data-open:slide-in-from-right-0 motion-reduce:data-closed:slide-out-to-right-0'
        }
      >
        <div className="sticky top-0 z-10 flex flex-col gap-0.5 border-b border-border bg-popover px-4 py-3">
          <DialogTitle render={<h3 />} className="font-heading text-base font-semibold">
            {format(new Date(`${day}T12:00:00`), 'EEEE, MMMM d, yyyy')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'filing' : 'filings'} this day.
          </DialogDescription>
        </div>

        <ul className="flex flex-col divide-y divide-border px-4">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1.5 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="font-medium">{row.userName}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{absenceKindLabel(row.kind)}</span>
                  {!exemptsWholeDay(row.kind) ? (
                    <span className="ml-1.5 rounded bg-muted px-1 py-px font-mono text-2xs">
                      part day — still owes a log
                    </span>
                  ) : null}
                </span>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {row.startDate}
                {row.endDate !== row.startDate && ` to ${row.endDate}`} · {row.status}
              </span>
              {row.reason ? (
                <span className={cn(bilingualText, 'text-xs text-muted-foreground')}>{row.reason}</span>
              ) : null}
              {row.status === 'pending' && row.canReview ? (
                <ApprovalActions id={row.id} kind="absence" isSelf={row.userId === actorId} />
              ) : null}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
