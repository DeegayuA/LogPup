import type { DueKind } from '@/features/sprints/due-date'

/**
 * What a person is told when work lands on their board from somebody else.
 *
 * Pure, and separate from the action that writes it, for the usual reason in
 * this repo: the wording IS the feature here. A notification is the only part
 * of an assignment the recipient reads before deciding what to do, and the
 * rules below — when a deadline is mentioned, when it is not, whose name leads
 * — are judgements that deserve tests rather than a template buried in a
 * server action nobody can run without a database.
 */

export type AssignmentNotice = {
  title: string
  body: string | null
  link: string
}

export type AssignmentInput = {
  taskTitle: string
  /** Who did the assigning. Never the recipient — see shouldNotifyAssignee. */
  assignerName: string
  appName: string
  appSlug: string
  /** ISO day, or null when the task carries no deadline. */
  dueDate: string | null
  dueKind: DueKind
}

/** Notification titles sit in a list; past this they are truncated by the UI
 *  anyway, and a title that wraps to three lines buries the ones under it. */
const MAX_TITLE = 90

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

/**
 * SILENT ON TARGETS, EXPLICIT ON COMMITMENTS.
 *
 * A target date is an intention; the task row states it and the recipient will
 * see it the moment they open the board. Repeating it here would make every
 * hand-off read as a deadline reminder, which is how people learn to skim
 * notifications.
 *
 * A committed date is different in kind, not degree: `deadline.commit` is an
 * APPROVAL_ACTION precisely because committing a date is speaking for the
 * studio to somebody who will plan around it. Handing that to a person without
 * saying so transfers an obligation they never agreed to and did not know
 * about — the shape that produces "nobody told me this was promised to the
 * client". So the commitment is named, and only the commitment.
 *
 * Factual, never urgent. It is a fact about the task, not pressure on the
 * person, and a notification that editorialises about lateness is one people
 * turn off.
 */
export function buildAssignmentNotice(input: AssignmentInput): AssignmentNotice {
  const { taskTitle, assignerName, appName, appSlug, dueDate, dueKind } = input

  const title = clip(`${assignerName} assigned you “${taskTitle}”`, MAX_TITLE)

  const parts = [appName]
  if (dueKind === 'committed' && dueDate) parts.push(`committed, due ${dueDate}`)

  return {
    title,
    body: parts.join(' · '),
    // The board, not the task: there is no per-task route in this product, and
    // a link that 404s is worse than a link to the list the task is on.
    link: `/apps/${appSlug}`,
  }
}

/**
 * Should this assignment notify at all?
 *
 * No when you assigned it to yourself — you were there. No when there is no
 * assignee, which is a task on a backlog rather than a hand-off to a person.
 * Those two are the whole rule: the moment worth a notification is work
 * CROSSING from one person to another.
 */
export function shouldNotifyAssignee(
  assigneeId: string | null | undefined,
  actorId: string,
): assigneeId is string {
  return Boolean(assigneeId) && assigneeId !== actorId
}
