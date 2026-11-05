/**
 * The board's view model: how a flat list of tasks becomes columns, which of
 * them survive the filter bar, and how both of those round-trip through the
 * URL.
 *
 * WHY THE URL OWNS THE VIEW. A board that resets its grouping and filters on
 * every navigation is a board you cannot share, bookmark, or reload without
 * losing your place. The cost is that every knob has to serialise to
 * something short and legible — hence `?group=assignee&who=<id>&overdue=1`
 * rather than an opaque blob.
 *
 * The board writes these with `replaceState`, NOT `pushState`, so the back
 * button leaves the board rather than stepping back through filters. That is
 * the deliberate trade: the search box settles after every pause in typing,
 * and pushState would bury the page the user arrived from under one history
 * entry per typed word. Nothing in this module depends on which one the
 * caller picks.
 *
 * WHY GROUPING IS A DROP TARGET, NOT JUST A LAYOUT. Grouping by assignee and
 * dragging a card into someone else's column IS a reassignment; grouping by
 * priority and dragging up a column IS a priority change. `patchForGroup`
 * is the single place that says what a column means, so the drag handler
 * never has to branch on the grouping itself.
 *
 * Everything here is pure and colocated with board-view.test.ts. The board
 * component is big enough already, and this is precisely the branchy logic
 * that must not be trapped inside a client component.
 */

// The PRD Module A workflow (migration 0079), in the task_status enum's own
// declaration order — main line first, then the side states, then done — so
// asc(status) still reads "unfinished first" everywhere it is used.
export const TASK_STATUSES = [
  'todo', 'in_progress', 'in_review', 'ready_for_qa', 'qa', 'qa_failed', 'rework',
  'ready_for_release', 'released', 'blocked', 'deferred', 'done',
] as const

/**
 * The main line the board shows as columns, left to right. The side states
 * (qa_failed, rework, blocked, deferred) get a column only while something is
 * in them: a board of twelve mostly-empty columns hides the work it exists to
 * show.
 */
export const MAIN_FLOW_STATUSES: readonly TaskStatus[] = [
  'todo', 'in_progress', 'in_review', 'ready_for_qa', 'qa', 'ready_for_release', 'released', 'done',
]
export type TaskStatus = (typeof TASK_STATUSES)[number]

/**
 * WHICH STATUSES MEAN "THIS TASK IS OVER".
 *
 * One set, derived one way: `TERMINAL` is the declaration, `OPEN_STATUSES` is
 * computed from it, and `isTerminal` reads it. Adding a status to the enum
 * means editing this Set and nothing else — which is the entire reason this
 * seam exists. Before it, "is this task finished" was the literal `'done'`
 * spelled out at every call site that asked — in plain comparisons, in
 * drizzle conditions, and inside `sql` templates, where a widened enum would
 * have gone wrong silently.
 *
 * It lives HERE, in the module that already owns `TASK_STATUSES`, rather than
 * in task-status.ts where it is used most: board-view.ts imports nothing at
 * all today, and task-status.ts type-imports `TaskStatus` from it. Defining
 * these there and importing them back would make a leaf module part of an
 * import cycle. task-status.ts re-exports them, so callers may import from
 * either and no call site cares which.
 *
 * NOT a `readonly string[]` include-check: a Set makes the membership test
 * O(1) at the board-render sites that call it per task, and the type keeps a
 * typo from compiling.
 */
const TERMINAL: ReadonlySet<TaskStatus> = new Set<TaskStatus>(['done'])

/** The statuses a task can hold and still be somebody's outstanding work. */
export const OPEN_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter(
  (status) => !TERMINAL.has(status),
)

/** The statuses that mean the task is over, however it ended. */
export const TERMINAL_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter((status) =>
  TERMINAL.has(status),
)

/**
 * Whether this status means the task is finished — by any route.
 *
 * Today that is exactly `'done'`. Callers must not assume it stays that way;
 * that assumption is the thing being removed.
 */
export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL.has(status)
}

/**
 * Every task on a board, in workflow order. The one way to flatten it: code
 * that spread `board.todo, board.in_progress, board.done` by name silently
 * dropped every task in the states added later (review, QA, …).
 */
export function flattenBoard<T>(board: Record<TaskStatus, T[]>): T[] {
  return TASK_STATUSES.flatMap((status) => board[status])
}

export type StatusBucket = 'todo' | 'in_progress' | 'done'
/**
 * The three-way summary every count, progress bar and dashboard tile was
 * built on (to do / in progress / done), so widening the workflow does not
 * rewrite them all. "Not started" is todo and deferred; "done" is done; every
 * state in between — review, QA, rework, blocked, released-but-not-closed —
 * is work in progress.
 */
export function statusBucket(status: TaskStatus): StatusBucket {
  if (status === 'done') return 'done'
  if (status === 'todo' || status === 'deferred') return 'todo'
  return 'in_progress'
}

/**
 * The statuses each non-done bucket expands to, for SQL `IN (...)` filters.
 * Queries that used to say `status = 'in_progress'` meant "work in flight";
 * after the workflow widened, that literal silently dropped review, QA,
 * rework and blocked tasks. Derived from `statusBucket` so the SQL and the
 * in-memory summary can never disagree about what a bucket holds.
 */
export const IN_FLIGHT_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter(
  (s) => statusBucket(s) === 'in_progress',
)
export const NOT_STARTED_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter(
  (s) => statusBucket(s) === 'todo',
)

/**
 * The card quick menu's "Move to …" targets. Twelve entries made the menu a
 * wall of options most of which were wrong for the card in hand, so it offers
 * the step back and the step forward along the main line, plus the two exits
 * that apply from anywhere — Blocked and Done. A side state (QA failed,
 * rework, blocked, deferred) has no place on the line, so its way back is
 * plain In progress. The full list stays in the task dialog's Status select.
 */
export function quickMoveTargets(current: TaskStatus): TaskStatus[] {
  const index = MAIN_FLOW_STATUSES.indexOf(current)
  const steps: TaskStatus[] =
    index === -1
      ? ['in_progress']
      : [MAIN_FLOW_STATUSES[index - 1], MAIN_FLOW_STATUSES[index + 1]].filter(
          (s): s is TaskStatus => s !== undefined,
        )
  const targets: TaskStatus[] = []
  for (const status of [...steps, 'blocked', 'done'] as const) {
    if (status !== current && !targets.includes(status)) targets.push(status)
  }
  return targets
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'Code review',
  ready_for_qa: 'Ready for QA',
  qa: 'QA',
  qa_failed: 'QA failed',
  rework: 'Rework required',
  ready_for_release: 'Ready for release',
  released: 'Released',
  blocked: 'Blocked',
  deferred: 'Deferred',
  done: 'Done',
}

export const PRIORITY_LABEL: Record<number, string> = {
  0: 'No priority',
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

/** Sentinel column id for "nobody" — a real UUID can never collide with it,
 *  and it has to be a string because it doubles as a dnd-kit droppable id. */
export const UNASSIGNED_GROUP = 'unassigned'

export type BoardTask = {
  id: string
  title: string
  status: TaskStatus
  priority: number
  sortOrder: number
  createdAt: Date
  dueDate: string | null
  assignee: { id: string; name: string; avatarUrl: string | null } | null
}

export const GROUP_BY_VALUES = ['status', 'assignee', 'priority'] as const
export type GroupBy = (typeof GROUP_BY_VALUES)[number]

export const GROUP_BY_LABEL: Record<GroupBy, string> = {
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
}

export type BoardFilters = {
  /** Free text, matched case-insensitively against title and description. */
  query: string
  /** User ids, plus possibly UNASSIGNED_GROUP. Empty = no assignee filter. */
  assignees: string[]
  /** Priority codes 0–3. Empty = no priority filter. */
  priorities: number[]
  /** Only tasks past their due date and not yet done. */
  overdueOnly: boolean
}

export type BoardView = { groupBy: GroupBy; filters: BoardFilters }

export const EMPTY_FILTERS: BoardFilters = {
  query: '',
  assignees: [],
  priorities: [],
  overdueOnly: false,
}

/** The subset of URLSearchParams this module needs — so Next's
 *  ReadonlyURLSearchParams and a plain URLSearchParams both fit. */
type ReadableParams = { get(name: string): string | null }

function splitList(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function parseBoardView(params: ReadableParams): BoardView {
  const rawGroup = params.get('group')
  const groupBy: GroupBy = (GROUP_BY_VALUES as readonly string[]).includes(rawGroup ?? '')
    ? (rawGroup as GroupBy)
    : 'status'

  const priorities = splitList(params.get('prio'))
    .map(Number)
    // A hand-edited `?prio=99` must not produce a filter that matches nothing
    // with no way to see why — unknown codes are dropped, not honoured.
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 3)

  return {
    groupBy,
    filters: {
      query: (params.get('q') ?? '').trim(),
      assignees: splitList(params.get('who')),
      priorities: [...new Set(priorities)].sort((a, b) => a - b),
      overdueOnly: params.get('overdue') === '1',
    },
  }
}

/**
 * The view as URL params. A `null` value means "delete this key" — the caller
 * applies the patch over the CURRENT params so unrelated keys (`?sprint=`,
 * `?tab=`) survive. Defaults serialise to null rather than to their literal
 * value so a board in its default state has a clean URL.
 */
export function boardViewPatch(view: BoardView): Record<string, string | null> {
  return {
    group: view.groupBy === 'status' ? null : view.groupBy,
    q: view.filters.query ? view.filters.query : null,
    who: view.filters.assignees.length > 0 ? view.filters.assignees.join(',') : null,
    prio: view.filters.priorities.length > 0 ? view.filters.priorities.join(',') : null,
    overdue: view.filters.overdueOnly ? '1' : null,
  }
}

/** How many filters are switched on — drives the "N" badge and whether a
 *  "Clear" affordance is worth showing at all. The free-text box counts as
 *  one filter no matter how long the phrase. */
export function activeFilterCount(filters: BoardFilters): number {
  return (
    (filters.query ? 1 : 0) +
    filters.assignees.length +
    filters.priorities.length +
    (filters.overdueOnly ? 1 : 0)
  )
}

/**
 * Past its due date and still not done. `todayIso` is a plain yyyy-mm-dd
 * string so the comparison is a lexicographic string compare in the same
 * calendar space as the `date` column — no Date parsing, no timezone drift.
 * A task due TODAY is not overdue; it is due today, which is a different
 * (and much less alarming) thing to tell someone.
 */
export function isOverdue(task: Pick<BoardTask, 'dueDate' | 'status'>, todayIso: string): boolean {
  if (!task.dueDate) return false
  if (isTerminal(task.status)) return false
  return task.dueDate < todayIso
}

export function isDueToday(task: Pick<BoardTask, 'dueDate' | 'status'>, todayIso: string): boolean {
  if (!task.dueDate) return false
  if (isTerminal(task.status)) return false
  return task.dueDate === todayIso
}

export function matchesFilters(
  task: BoardTask & { description?: string | null },
  filters: BoardFilters,
  todayIso: string,
): boolean {
  if (filters.overdueOnly && !isOverdue(task, todayIso)) return false

  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false

  if (filters.assignees.length > 0) {
    const key = task.assignee?.id ?? UNASSIGNED_GROUP
    if (!filters.assignees.includes(key)) return false
  }

  if (filters.query) {
    const needle = filters.query.toLowerCase()
    // Description is searched too: a task's title is often a stub and the
    // detail people remember ("the Stripe webhook one") lives in the body.
    const haystack = `${task.title}\n${task.description ?? ''}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }

  return true
}

export type BoardGroup<T extends BoardTask = BoardTask> = {
  /** Doubles as the dnd-kit droppable id, so it must be unique per board. */
  id: string
  title: string
  /** Optional second line — e.g. an assignee column's task count context. */
  tasks: T[]
}

export type GroupContext = {
  /** Everyone on the app team, so a person with no tasks still gets a column
   *  you can drag work onto. Without this, assignee grouping can only ever
   *  reassign to someone who already has something. */
  team: { userId: string; name: string }[]
}

/**
 * What dropping a card into `groupId` means, as a task patch. `null` when the
 * id isn't a column of this grouping (a stale droppable id, or a drop that
 * landed nowhere) — the caller treats that as "no change" rather than
 * guessing.
 */
export type GroupPatch = {
  status?: TaskStatus
  assigneeId?: string | null
  priority?: number
}

export function patchForGroup(groupBy: GroupBy, groupId: string): GroupPatch | null {
  if (groupBy === 'status') {
    return (TASK_STATUSES as readonly string[]).includes(groupId)
      ? { status: groupId as TaskStatus }
      : null
  }
  if (groupBy === 'assignee') {
    return { assigneeId: groupId === UNASSIGNED_GROUP ? null : groupId }
  }
  const priority = Number(groupId)
  if (!Number.isInteger(priority) || priority < 0 || priority > 3) return null
  return { priority }
}

/** The group a task currently belongs to under `groupBy` — the inverse of
 *  `patchForGroup`, used to tell a real move from a drop back onto home. */
export function groupIdForTask(groupBy: GroupBy, task: BoardTask): string {
  if (groupBy === 'status') return task.status
  if (groupBy === 'assignee') return task.assignee?.id ?? UNASSIGNED_GROUP
  return String(task.priority)
}

/**
 * Buckets tasks into columns. Columns are always emitted in a FIXED order
 * (workflow order for status, high→none for priority, unassigned-last for
 * assignee) and always emitted even when empty — a board whose columns
 * appear and vanish as work moves is disorienting, and an empty column is a
 * drop target you need.
 *
 * Assignee grouping lists the app team first, then anyone who holds a task
 * without being on the team any more (a removed teammate's work must not
 * silently disappear from the board).
 */
export function groupTasks<T extends BoardTask>(
  tasks: T[],
  groupBy: GroupBy,
  context: GroupContext,
): BoardGroup<T>[] {
  const groups: BoardGroup<T>[] = []

  if (groupBy === 'status') {
    // The main line always (empty columns are drop targets); a side state
    // (blocked, QA failed, rework, deferred) only while a task is in it —
    // twelve columns, most of them empty, would bury the work. Still in the
    // fixed TASK_STATUSES order, so columns never reshuffle.
    const used = new Set(tasks.map((t) => t.status))
    for (const status of TASK_STATUSES) {
      if (!MAIN_FLOW_STATUSES.includes(status) && !used.has(status)) continue
      groups.push({ id: status, title: STATUS_LABEL[status], tasks: [] })
    }
  } else if (groupBy === 'priority') {
    for (const priority of [3, 2, 1, 0]) {
      groups.push({ id: String(priority), title: PRIORITY_LABEL[priority], tasks: [] })
    }
  } else {
    for (const member of context.team) {
      groups.push({ id: member.userId, title: member.name, tasks: [] })
    }
    const known = new Set(context.team.map((m) => m.userId))
    const orphans = new Map<string, string>()
    for (const task of tasks) {
      if (task.assignee && !known.has(task.assignee.id)) {
        orphans.set(task.assignee.id, task.assignee.name)
      }
    }
    for (const [id, name] of orphans) groups.push({ id, title: name, tasks: [] })
    groups.push({ id: UNASSIGNED_GROUP, title: 'Unassigned', tasks: [] })
  }

  const byId = new Map(groups.map((group) => [group.id, group]))
  for (const task of tasks) {
    // A task whose group vanished (priority outside 0–3 from a direct DB
    // edit) still has to land somewhere visible rather than be dropped.
    const group = byId.get(groupIdForTask(groupBy, task)) ?? groups[groups.length - 1]
    group.tasks.push(task)
  }

  return groups
}

/**
 * Where a dragged card lands, as an index into its destination column WITH
 * THE CARD REMOVED — the shape `planInsert` in task-rank.ts expects.
 *
 * `overId` is the card the pointer was released on, or `null` when the drop
 * landed on the column itself (its empty area, or the gap below the last
 * card), which means "append".
 *
 * THE COLUMN PASSED IN MUST BE THE UNFILTERED ONE. This is the whole reason
 * the calculation is a function rather than three lines inside the drag
 * handler. A rank is a position among ALL the cards in a column, not among
 * the ones a filter happens to be showing: compute it against the filtered
 * list and a drop between two visible cards produces a rank that ignores
 * every hidden card sitting between them, and — far worse — a rebalance
 * re-spreads only the visible cards to 1024, 2048, 3072… while the hidden
 * ones keep their old ranks, scattering them through the column at random.
 * That is silent reordering of work the user cannot see, triggered by the
 * ordinary act of filtering a board and dragging a card.
 *
 * DIRECTION MATTERS. Dropping onto a card BELOW where you started means
 * "after it"; onto one above means "before it". Without that asymmetry a
 * card can only ever land above the card you aimed at, which makes dragging
 * to the bottom of a column impossible.
 */
export function dropIndexIn(
  column: readonly { id: string }[],
  draggedId: string,
  overId: string | null,
): number {
  const without = column.filter((task) => task.id !== draggedId)
  if (overId === null || overId === draggedId) return without.length

  const overIndex = without.findIndex((task) => task.id === overId)
  // The card under the pointer isn't in this column (a stale droppable id, or
  // a drop that resolved to a card the column no longer holds): append rather
  // than guess at a position.
  if (overIndex === -1) return without.length

  const fromIndex = column.findIndex((task) => task.id === draggedId)
  const overOriginalIndex = column.findIndex((task) => task.id === overId)
  return fromIndex !== -1 && fromIndex < overOriginalIndex ? overIndex + 1 : overIndex
}

export type BoardSummary = {
  total: number
  done: number
  inProgress: number
  todo: number
  overdue: number
  unassigned: number
  /** Whole percent 0–100, floored. 0 for an empty board (not NaN). */
  donePct: number
}

/** The numbers that go across the top of the board. Deliberately computed
 *  from the FILTERED list the user is actually looking at: a summary that
 *  describes a different set of tasks than the columns below it is worse
 *  than no summary. */
export function boardSummary(tasks: BoardTask[], todayIso: string): BoardSummary {
  let done = 0
  let inProgress = 0
  let todo = 0
  let overdue = 0
  let unassigned = 0

  for (const task of tasks) {
    if (isTerminal(task.status)) done += 1
    else if (statusBucket(task.status) === 'in_progress') inProgress += 1
    else todo += 1
    if (isOverdue(task, todayIso)) overdue += 1
    if (!task.assignee) unassigned += 1
  }

  const total = tasks.length
  return {
    total,
    done,
    inProgress,
    todo,
    overdue,
    unassigned,
    donePct: total === 0 ? 0 : Math.floor((done / total) * 100),
  }
}
