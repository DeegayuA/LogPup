import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { checkinGap, computeTaskProgress } from '@/features/sprints/checkins'
import { getSprintCheckins } from '@/features/sprints/checkin-queries'
import { getBoard } from '@/features/sprints/queries'
import {
  GapHint,
  SprintCheckinEditor,
} from '@/features/sprints/components/sprint-checkin-editor'

type Person = { id: string; name: string; avatarUrl: string | null }

/**
 * The check-in strip on the app overview: for the current sprint, each
 * person's board-computed progress next to what they SAY their progress is
 * (see checkins.ts for why that comparison is the whole feature).
 *
 * Server component on purpose — the roster, the computed numbers and the
 * saved check-ins are all facts the server already knows, so only the
 * signed-in user's editor (sprint-checkin-editor.tsx) ships JavaScript.
 *
 * Tasks come from getBoard rather than a new narrower query: the strip only
 * needs assigneeId/status, but the board query already exists, is bounded to
 * one sprint, and carries the assignee's name/avatar this list renders —
 * a bespoke twin of it would be one more query to keep in step for the
 * price of a few unused columns.
 */
export async function SprintCheckins({
  appId,
  sprintId,
  currentUser,
}: {
  appId: string
  sprintId: string
  /** The signed-in viewer; null renders the strip read-only (no editor row). */
  currentUser: Person | null
}) {
  const [board, checkins] = await Promise.all([
    getBoard(appId, sprintId),
    getSprintCheckins(sprintId),
  ])

  const sprintTasks = [...board.todo, ...board.in_progress, ...board.done]
  const taskRows = sprintTasks.map((task) => ({
    assigneeId: task.assignee?.id ?? null,
    status: task.status,
  }))

  // Roster = everyone assigned a task in this sprint ∪ everyone who already
  // checked in ∪ the viewer. The union matters in both directions: a person
  // with tasks but no check-in is a row saying "not heard from yet", and a
  // person who checked in after their tasks moved elsewhere keeps their say
  // on the record. The viewer is always present so the editor is always
  // reachable — the action lets any approved user check in, tasks or not.
  const people = new Map<string, Person>()
  for (const task of sprintTasks) {
    if (task.assignee) people.set(task.assignee.id, task.assignee)
  }
  for (const checkin of checkins) {
    if (!people.has(checkin.userId)) {
      people.set(checkin.userId, {
        id: checkin.userId,
        name: checkin.userName,
        avatarUrl: checkin.userAvatarUrl,
      })
    }
  }
  if (currentUser && !people.has(currentUser.id)) {
    people.set(currentUser.id, currentUser)
  }

  const checkinByUser = new Map(checkins.map((checkin) => [checkin.userId, checkin]))

  // Viewer pinned first so the editor never hides mid-list; everyone else in
  // name order, matching the roster order checkin-queries already returns.
  const viewer = currentUser ? (people.get(currentUser.id) ?? null) : null
  const roster = [
    ...(viewer ? [viewer] : []),
    ...[...people.values()]
      .filter((person) => person.id !== viewer?.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  ]

  return (
    <section
      // The anchor PlanReadStrip's "check-ins disagree" chip points at, from
      // the Roadmap tab. scroll-mt clears the sticky app chrome so the
      // heading isn't cut off when the fragment lands.
      id="checkins"
      aria-label="Sprint check-ins"
      className="flex scroll-mt-20 flex-col gap-3"
    >
      <div className="flex items-baseline gap-2">
        <h2 className="font-heading text-base font-medium">Check-ins</h2>
        {checkins.length > 0 ? (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {checkins.length}
          </span>
        ) : null}
      </div>

      {checkins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No check-ins yet this sprint.</p>
      ) : null}

      {roster.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {roster.map((person) => {
            const computed = computeTaskProgress(taskRows, person.id)
            const checkin = checkinByUser.get(person.id)
            const isViewer = person.id === viewer?.id
            return (
              <li key={person.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    {person.avatarUrl ? (
                      <AvatarImage src={person.avatarUrl} alt={person.name} />
                    ) : null}
                    <AvatarFallback>{person.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {person.name}
                    {isViewer ? <span className="text-muted-foreground"> (you)</span> : null}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {computed.percent === null
                      ? 'No tasks'
                      : `${computed.done}/${computed.total} tasks · ${computed.percent}%`}
                  </span>
                </div>

                {/* pl-9 = avatar (size-6) + gap-3, so detail lines sit under the name. */}
                <div className="pl-9">
                  {isViewer ? (
                    <SprintCheckinEditor
                      sprintId={sprintId}
                      initial={checkin ? { percent: checkin.percent, note: checkin.note } : null}
                      computedPercent={computed.percent}
                    />
                  ) : checkin ? (
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-mono font-medium tabular-nums">
                        says {checkin.percent}%
                      </span>
                      <GapHint verdict={checkinGap(checkin.percent, computed)} />
                      {checkin.note ? (
                        <span className="min-w-0 text-muted-foreground">“{checkin.note}”</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not checked in yet</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
