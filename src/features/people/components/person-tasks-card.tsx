import Link from 'next/link'
import { format } from 'date-fns'
import { PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionEmpty } from '@/features/people/components/section-empty'
import { isoDayDiff } from '@/features/people/iso-day'
import {
  bucketOpenTasks,
  type DueState,
  type PersonTaskRow,
} from '@/features/people/task-workload'
import { cn } from '@/lib/utils'

const linkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

/** Only lateness gets colour. "Later" and "no due date" are chrome. */
const DUE_TONE: Record<DueState, string> = {
  overdue: 'text-destructive',
  today: 'text-chart-1',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
  none: 'text-muted-foreground',
}

const DUE_DOT: Record<DueState, string> = {
  overdue: 'bg-destructive',
  today: 'bg-chart-1',
  soon: 'bg-primary',
  later: 'bg-muted-foreground/40',
  none: 'bg-muted-foreground/25',
}

const STATUS_LABEL: Record<PersonTaskRow['status'], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

// Same ramp as the board's task cards: 0 draws nothing, then sage → ember →
// danger. No new hues, and priority is named in text for the dot's aria-label.
const PRIORITY_DOT: Record<number, string | null> = {
  0: null,
  1: 'bg-chart-2',
  2: 'bg-chart-1',
  3: 'bg-destructive',
}

const PRIORITY_LABEL: Record<number, string> = {
  0: 'No priority',
  1: 'Low priority',
  2: 'Medium priority',
  3: 'High priority',
}

/**
 * Plain `YYYY-MM-DD` from the `date` column, anchored to local noon before
 * formatting. Handing the bare string to `new Date()` parses it as midnight
 * UTC, which renders as the previous day in any negative-offset zone — the same
 * trap the sprint dates on the app page document.
 */
function formatDueDate(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), 'MMM d')
}

function dueSuffix(iso: string, todayIso: string, state: DueState): string | null {
  if (state === 'today') return 'today'
  const days = isoDayDiff(iso, todayIso)
  if (state === 'overdue') return `${Math.abs(days)}d late`
  return state === 'soon' ? `in ${days}d` : null
}

/**
 * Open work, grouped by how late it is rather than by status.
 *
 * The old card grouped by To do / In progress / Done and rendered every done
 * task ever — so the section grew forever and still could not answer "is
 * anything late". Status is now a small label on the row (it matters, but it is
 * not the organising question), the groups are Overdue → Due today → This week
 * → Later → No due date, and done work is a count in the header and a figure in
 * the stat strip. See task-workload.ts for why "done recently" is not derivable
 * from this schema.
 *
 * Long groups collapse into a native <details>: server-rendered, keyboard
 * operable and searchable by the browser's own find, with no client JS at all.
 */
const VISIBLE_PER_GROUP = 5

export function PersonTasksCard({
  openTasks,
  todayIso,
  doneCount,
  totalCount,
}: {
  openTasks: PersonTaskRow[]
  todayIso: string
  doneCount: number
  totalCount: number
}) {
  const buckets = bucketOpenTasks(openTasks, todayIso)

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Tasks</CardTitle>
        <CardAction>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {openTasks.length} open · {doneCount} done of {totalCount}
          </span>
        </CardAction>
      </CardHeader>

      {buckets.length === 0 ? (
        // Only the never-had-a-task branch gets a button. "All their tasks are
        // closed" is good news, and a call to action under it would read as a
        // demand to go and find them more work. The other branch names a place
        // — any app board — and this is the only way to get there from here.
        // Composing a task is open to everyone (see the board's own empty
        // state), so the offer promises nothing a member cannot do.
        <SectionEmpty
          icon={PawPrint}
          title="Nothing open."
          hint={
            totalCount > 0
              ? `All ${totalCount} tasks ever assigned to them are closed.`
              : 'No tasks have been assigned to them yet — add one from any app board.'
          }
          action={
            totalCount === 0 ? (
              <Button variant="outline" size="sm" render={<Link href="/apps" />}>
                Go to apps
              </Button>
            ) : undefined
          }
        />
      ) : (
        <CardContent className="flex flex-col gap-4">
          {buckets.map((bucket) => {
            const visible = bucket.tasks.slice(0, VISIBLE_PER_GROUP)
            const hidden = bucket.tasks.slice(VISIBLE_PER_GROUP)
            return (
              <section key={bucket.state} className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <h3
                    className={cn(
                      'text-xs font-semibold tracking-wide uppercase',
                      bucket.state === 'overdue' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {bucket.label}
                  </h3>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {bucket.tasks.length}
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {visible.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      state={bucket.state}
                      todayIso={todayIso}
                    />
                  ))}
                </ul>
                {hidden.length > 0 ? (
                  <details className="group/more">
                    <summary className="w-fit cursor-pointer list-none rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="group-open/more:hidden">
                        Show {hidden.length} more
                      </span>
                      <span className="hidden group-open/more:inline">Show fewer</span>
                    </summary>
                    <ul className="mt-1.5 flex flex-col divide-y divide-border rounded-lg border border-border">
                      {hidden.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          state={bucket.state}
                          todayIso={todayIso}
                        />
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>
            )
          })}
        </CardContent>
      )}
    </Card>
  )
}

function TaskRow({
  task,
  state,
  todayIso,
}: {
  task: PersonTaskRow
  state: DueState
  todayIso: string
}) {
  const priorityDot = PRIORITY_DOT[task.priority] ?? null
  const suffix = task.dueDate ? dueSuffix(task.dueDate, todayIso, state) : null

  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', DUE_DOT[state])} aria-hidden />
        <span className="min-w-0 flex-1 text-sm">{task.title}</span>
        {priorityDot ? (
          <span
            role="img"
            aria-label={PRIORITY_LABEL[task.priority]}
            className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', priorityDot)}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-3.5 text-2xs text-muted-foreground">
        <Link href={`/apps/${task.appSlug}`} className={cn('truncate', linkClass)}>
          {task.appName}
        </Link>
        <span aria-hidden>·</span>
        <span className="truncate">{task.sprintName ?? 'Backlog'}</span>
        <span aria-hidden>·</span>
        <span>{STATUS_LABEL[task.status]}</span>
        {task.dueDate ? (
          <>
            <span aria-hidden>·</span>
            <time
              dateTime={task.dueDate}
              className={cn('font-mono tabular-nums', DUE_TONE[state])}
            >
              {formatDueDate(task.dueDate)}
              {suffix ? ` · ${suffix}` : ''}
            </time>
          </>
        ) : null}
      </div>
    </li>
  )
}
