/**
 * "What is this person doing now, and what have they been doing?" — the two
 * questions /people could not answer.
 *
 * The directory has always shown ALLOCATION: percentages against apps, which
 * is a statement of intent made when someone was assigned. It never showed
 * work. Two people can both read "Alpha 50%" while one has three overdue
 * tasks and the other has none, and the page looked identical.
 *
 * NOW is deliberately narrow: tasks that are actually in progress. Not
 * everything open — a backlog of forty todos is not "what they are doing", it
 * is what they have been given, and conflating the two is how a workload page
 * stops being read. If nothing is in progress that is a real, useful answer
 * and it is said plainly rather than padded with the todo list.
 *
 * HISTORY is the activity log, which already records every change as
 * actor + verb + entity + detail. Nothing here infers or reconstructs: if the
 * log did not record it, this does not claim it happened.
 */

/** A task someone is working on right now. */
export type NowTask = {
  id: string
  title: string
  appName: string | null
  appSlug: string | null
  sprintName: string | null
  /** Plain yyyy-mm-dd as stored — compared as a string, never parsed. */
  dueDate: string | null
  priority: number
}

/** One thing the activity log says a person did. */
export type RecentAction = {
  id: string
  verb: string
  entityType: string
  entityLabel: string
  appName: string | null
  detail: string | null
  pagePath: string | null
  at: Date
}

export type PersonNow = {
  doing: NowTask[]
  recent: RecentAction[]
}

export const EMPTY_NOW: PersonNow = { doing: [], recent: [] }

/**
 * How many in-progress tasks to name per person before summarising the rest.
 * Two fits one line at the directory's density; a third pushes the row to a
 * height that breaks the scan down the column, which is the whole point of a
 * directory.
 */
export const NAMED_TASKS = 2

/** How far back "recently" reaches, in days. */
export const RECENT_DAYS = 14

/** How many logged actions to keep per person. */
export const RECENT_ACTIONS = 5

/**
 * Most urgent first: overdue, then due soonest, then higher priority, then
 * title so the order is stable when everything else ties.
 *
 * A task with no due date sorts after every dated one — it is not urgent, it
 * is unscheduled, and floating it to the top on priority alone would bury the
 * thing that is actually late.
 */
export function sortNowTasks(tasks: NowTask[], todayIso: string): NowTask[] {
  return [...tasks].sort((a, b) => {
    const aOverdue = isOverdue(a, todayIso)
    const bOverdue = isOverdue(b, todayIso)
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1

    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    }

    if (a.priority !== b.priority) return b.priority - a.priority
    return a.title.localeCompare(b.title)
  })
}

export function isOverdue(task: NowTask, todayIso: string): boolean {
  return task.dueDate !== null && task.dueDate < todayIso
}

/**
 * The one-line answer to "what are they on right now", in words.
 *
 * Returns null when nothing is in progress, so the caller renders its own
 * empty state rather than printing a sentence that says nothing. "Nothing in
 * progress" is information — it just is not a headline.
 */
export function nowHeadline(doing: NowTask[], todayIso: string): string | null {
  if (doing.length === 0) return null
  const sorted = sortNowTasks(doing, todayIso)
  const named = sorted.slice(0, NAMED_TASKS).map((task) => task.title)
  const rest = sorted.length - named.length
  const head = named.join(', ')
  return rest > 0 ? `${head} +${rest} more` : head
}

/** How many of these are late. Drives the row's one warning, not a per-task badge. */
export function overdueCount(doing: NowTask[], todayIso: string): number {
  return doing.filter((task) => isOverdue(task, todayIso)).length
}

/**
 * Past-tense verbs for the log's vocabulary.
 *
 * The log stores verbs bare ('created', 'moved') because the feed renders them
 * next to an actor. Here the actor is the row, so the sentence starts at the
 * verb and it has to read as something already done. Unknown verbs pass
 * through untouched rather than being guessed at — a new verb reading slightly
 * flat is better than one rendered as a word its writer never meant.
 */
const VERB_PAST: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  moved: 'Moved',
  completed: 'Completed',
  reopened: 'Reopened',
  assigned: 'Assigned',
  unassigned: 'Unassigned',
  rsvp: 'Replied to',
  resolved: 'Resolved',
  approved: 'Approved',
  rejected: 'Rejected',
  commented: 'Commented on',
  restored: 'Restored',
  removed: 'Removed',
}

/**
 * One logged action as a sentence: "Moved Fix login — to In progress".
 *
 * `detail` is the log's own human fragment ("moved to In progress", "due
 * Friday"). It is appended rather than parsed: it was written to complete
 * exactly this sentence, and re-deriving it here would let the two drift.
 */
export function actionSentence(action: RecentAction): string {
  const verb = VERB_PAST[action.verb] ?? capitalise(action.verb)
  const base = `${verb} ${action.entityLabel}`
  return action.detail ? `${base} — ${action.detail}` : base
}

function capitalise(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)
}

/**
 * What someone has been doing lately, as a count per kind of thing:
 * "3 tasks, 1 meeting". Sorted by count so the dominant kind leads, then by
 * name for stability.
 *
 * Plural handling is deliberate and English-only — every entityType the log
 * writes is a lowercase singular noun that pluralises with 's'.
 */
export function recentSummary(recent: RecentAction[]): string | null {
  if (recent.length === 0) return null
  const counts = new Map<string, number>()
  for (const action of recent) {
    counts.set(action.entityType, (counts.get(action.entityType) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`)
    .join(', ')
}
