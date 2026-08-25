/**
 * "Who should be in this meeting, and what do I ask them" — the pure half.
 *
 * WHY A DERIVATION, NEVER A STORED LIST
 * Every line this module produces is an assertion about live work ("3 tasks
 * past due on Alpha", "said 80%, board says 30%"). The moment such a line is
 * written down it starts rotting: the task gets ticked, the follow-up is
 * resolved, the sprint closes, and the sentence on screen keeps insisting
 * otherwise. A stale ask-list is worse than none, so nothing here is
 * persisted — `getMeetingPlanner` re-runs the whole derivation on every open,
 * and a line disappears because the row it came from stopped matching, not
 * because a cleanup job remembered to remove it.
 *
 * That is also why every ask carries an `href`: a claim about somebody's work
 * that you cannot click through to is a claim nobody can check.
 *
 * NO DATABASE IMPORT. The action layer (planner-actions.ts) fetches rows in a
 * fixed number of batched queries and hands them here, exactly the way
 * assembleMeetingPrep (notes.ts) is fed — so every branchy decision below is
 * unit-tested without a database, and the two surfaces cannot drift.
 *
 * SUGGESTIONS, NOT INVITES. Nothing here writes anything. `PlannerCandidate`
 * is a proposal; `meeting_attendees` is still only ever written from the ids a
 * human submitted through the meeting form.
 */

import { HEALTH_LABEL, type HealthLevel } from '@/features/apps/app-health'
import {
  checkinAskContext,
  checkinAskText,
  overdueAskText,
  overdueRowsByUserApp,
  plural,
  stalledAskText,
  stalledCount,
} from '@/features/meetings/ask-derivation'
import { boardHref } from '@/features/apps/tabs'
import { isTerminal, UNASSIGNED_GROUP } from '@/features/sprints/board-view'
import { checkinGap, computeTaskProgress, type CheckinGap } from '@/features/sprints/checkins'

export type PlannerRole = 'pm' | 'lead'

/**
 * Which kind of live row an ask was derived from. Ordering matters: it is the
 * fixed priority used to pick a candidate's one reason phrase and to sort the
 * asks inside a project group, so two reads of unchanged data produce the same
 * list in the same order.
 */
export const ASK_KINDS = ['followup', 'checkin', 'overdue', 'health', 'stalled', 'unassigned'] as const
export type AskKind = (typeof ASK_KINDS)[number]

export type PlannerAsk = {
  /**
   * Identity of the underlying ROW (or row-set), not of the sentence. It is
   * what the organiser's "drop this line" decision is keyed on, and it is
   * stable across reads for as long as the thing it names exists.
   */
  key: string
  kind: AskKind
  /** Which project group this belongs under. Null = "across these projects",
   *  used only for a follow-up whose source meeting shares more than one of
   *  this meeting's projects, where naming a single one would be a guess. */
  appId: string | null
  /** The question, in words. Never a bare number. */
  text: string
  /** Where the sentence came from, in words. Null when `text` says it all. */
  context: string | null
  /** In-app link to the rows this line was derived from. */
  href: string
  linkLabel: string
  /** True for a link that opens a standalone record page in a new tab. */
  external: boolean
  /** Only set on a check-in ask, so the surface can colour and word the three
   *  verdicts differently — 'unknown' is NOT 'none' and must never render the
   *  same (see checkins.ts). */
  gap?: CheckinGap
}

export type PlannerRoleHold = {
  appId: string
  role: PlannerRole
  /** True for a row migration 0034 assumed rather than watched happen
   *  (isBackfilled, features/apps/role-history.ts). The surface says so
   *  instead of presenting it as an observed appointment. */
  assumedAtMigration: boolean
}

export type PlannerCandidate = {
  userId: string
  name: string
  avatarUrl: string | null
  /** True when this person already holds a meeting_attendees row. */
  onInvite: boolean
  roles: PlannerRoleHold[]
  /** ONE phrase saying why they are here. Always non-empty. */
  reason: string
  asks: PlannerAsk[]
}

export type PlannerProject = {
  appId: string
  name: string
  slug: string
  healthLevel: HealthLevel
  /** The label for `healthLevel`, from app-health.ts. Never re-worded here. */
  healthLabel: string
  pmName: string | null
  leadName: string | null
  /** Carried alongside the names so the planner can hang a person card off
   *  them — a name you cannot act on is a name that made you go looking. */
  pmId: string | null
  leadId: string | null
}

export type MeetingPlan = {
  projects: PlannerProject[]
  candidates: PlannerCandidate[]
}

// --- row shapes the action layer supplies -----------------------------------

export type PlanProjectRow = {
  appId: string
  name: string
  slug: string
  healthLevel: HealthLevel
  /** Verbatim `appHealth(...).reasons`. NEVER restated, re-worded or
   *  re-derived — see the health rule in buildAsks below. */
  healthReasons: readonly string[]
}

export type PlanPersonRow = { userId: string; name: string; avatarUrl: string | null }

export type PlanRoleRow = {
  appId: string
  userId: string
  role: PlannerRole
  assumedAtMigration: boolean
}

export type PlanTaskRow = {
  appId: string
  sprintId: string | null
  assigneeId: string | null
  status: 'todo' | 'in_progress' | 'done'
  dueDate: string | null
}

export type PlanSprintRow = { sprintId: string; name: string; appId: string }

export type PlanCheckinRow = { sprintId: string; userId: string; percent: number }

export type PlanFollowupRow = {
  followupId: string
  userId: string
  text: string
  sourceMeetingId: string
  sourceMeetingTitle: string
  /** Which of THIS meeting's projects the source meeting also serves. */
  sharedAppIds: readonly string[]
}

export type AssembleMeetingPlanInput = {
  projects: readonly PlanProjectRow[]
  people: readonly PlanPersonRow[]
  roles: readonly PlanRoleRow[]
  attendeeIds: readonly string[]
  /** Not-done tasks on the meeting's projects. */
  openTasks: readonly PlanTaskRow[]
  /** Sprints of the meeting's projects that are running right now. */
  runningSprints: readonly PlanSprintRow[]
  /** EVERY task in those sprints, done ones included — computeTaskProgress
   *  needs the denominator, and a not-done-only feed would report everybody
   *  at 0%. */
  sprintTasks: readonly PlanTaskRow[]
  checkins: readonly PlanCheckinRow[]
  followups: readonly PlanFollowupRow[]
  /** Plain yyyy-mm-dd in Asia/Colombo — see lib/lk-holidays. Never a UTC slice. */
  todayIso: string
}

// --- helpers ----------------------------------------------------------------

// `plural`, `isPastDue`, the overdue roll-up and every ask sentence live in
// ask-derivation.ts — the workspace-wide sweep behind R6 COVER-TOGETHER
// derives the same asks from the same rows, and two copies of "3 tasks past
// due on Alpha" is how two surfaces end up disagreeing about somebody's week
// in two wordings a reader cannot check against each other.

function listNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The one phrase under a suggested person's name. Roles win when they exist —
 * "PM of Alpha" is why they are in the room, and it stays true whatever their
 * task board says today. Otherwise the strongest ask decides, in ASK_KINDS
 * order, so the same data always produces the same phrase.
 */
export function candidateReason(
  roles: readonly PlannerRoleHold[],
  asks: readonly PlannerAsk[],
  appName: (appId: string) => string,
): string {
  if (roles.length > 0) {
    const pms = roles.filter((r) => r.role === 'pm').map((r) => appName(r.appId))
    const leads = roles.filter((r) => r.role === 'lead').map((r) => appName(r.appId))
    const parts: string[] = []
    if (pms.length > 0) parts.push(`PM of ${listNames(pms)}`)
    if (leads.length > 0) parts.push(`lead on ${listNames(leads)}`)
    return parts.join(', ')
  }

  for (const kind of ASK_KINDS) {
    const mine = asks.filter((ask) => ask.kind === kind)
    if (mine.length === 0) continue
    if (kind === 'followup') {
      return `owes ${plural(mine.length, 'follow-up')} from earlier meetings`
    }
    if (kind === 'checkin') {
      return mine.length === 1
        ? 'a check-in that does not match the board'
        : `${mine.length} check-ins that do not match the board`
    }
    if (kind === 'overdue') {
      // One ask per project, so naming the projects is exact rather than a
      // pick-the-biggest guess.
      const names = mine.map((ask) => appName(ask.appId ?? '')).filter(Boolean)
      return `overdue work on ${listNames(names)}`
    }
    // health / stalled / unassigned only ever reach a role holder, who
    // returned above — but a phrase is still owed rather than an empty line.
    return mine[0].text
  }

  // Reached only for someone with a role-less, ask-less row, which
  // assembleMeetingPlan never emits. Kept total rather than throwing.
  return 'on this meeting'
}

// --- the derivation ---------------------------------------------------------

/**
 * Turns the batched rows into the plan. Deliberately total and deterministic:
 * every list is sorted by a stable key, so opening the panel twice on
 * unchanged data produces the identical agenda — which is what makes "this
 * line disappeared" mean "that work closed" rather than "the order shifted".
 */
export function assembleMeetingPlan(input: AssembleMeetingPlanInput): MeetingPlan {
  const projects = [...input.projects].sort((a, b) => a.name.localeCompare(b.name))
  const projectById = new Map(projects.map((p) => [p.appId, p]))
  const appName = (appId: string) => projectById.get(appId)?.name ?? ''
  const appSlug = (appId: string) => projectById.get(appId)?.slug ?? ''
  const personById = new Map(input.people.map((p) => [p.userId, p]))
  const attendeeIds = new Set(input.attendeeIds)

  const rolesByUser = new Map<string, PlannerRoleHold[]>()
  for (const row of input.roles) {
    if (!projectById.has(row.appId)) continue
    const list = rolesByUser.get(row.userId) ?? []
    list.push({ appId: row.appId, role: row.role, assumedAtMigration: row.assumedAtMigration })
    rolesByUser.set(row.userId, list)
  }
  // pm before lead, then project name — the order the phrase reads in.
  for (const list of rolesByUser.values()) {
    list.sort((a, b) =>
      a.role === b.role ? appName(a.appId).localeCompare(appName(b.appId)) : a.role === 'pm' ? -1 : 1,
    )
  }

  const holderOf = (appId: string, role: PlannerRole): string | null =>
    input.roles.find((row) => row.appId === appId && row.role === role)?.userId ?? null

  const asksByUser = new Map<string, PlannerAsk[]>()
  const addAsk = (userId: string, ask: PlannerAsk) => {
    const list = asksByUser.get(userId) ?? []
    list.push(ask)
    asksByUser.set(userId, list)
  }

  // --- overdue tasks, per person per project -------------------------------
  // Counted per (assignee, project) rather than emitted per task: "7 tasks
  // past due on Alpha" is one question at a meeting; seven lines is a backlog
  // reading. The link carries the same filter the count was computed from, so
  // the seven rows are one click away.
  // Keyed by a nested map rather than a joined string: joining two uuids means
  // splitting them again later, and a split is one more place for the pair to
  // come back swapped or truncated.
  const overdueRows = overdueRowsByUserApp(input.openTasks, input.todayIso, (appId) =>
    projectById.has(appId),
  )
  for (const { userId, appId, count } of overdueRows) {
    addAsk(userId, {
      key: `overdue:${userId}:${appId}`,
      kind: 'overdue',
      appId,
      text: overdueAskText(count, appName(appId)),
      context: null,
      href: boardHref(appSlug(appId), null, { who: userId, overdue: '1' }),
      linkLabel: 'Open on the board',
      external: false,
    })
  }

  // --- check-ins that disagree with the board ------------------------------
  const runningSprints = [...input.runningSprints]
    .filter((sprint) => projectById.has(sprint.appId))
    .sort((a, b) => a.name.localeCompare(b.name) || a.sprintId.localeCompare(b.sprintId))
  const sprintById = new Map(runningSprints.map((s) => [s.sprintId, s]))

  const tasksBySprint = new Map<string, PlanTaskRow[]>()
  for (const task of input.sprintTasks) {
    if (!task.sprintId) continue
    const group = tasksBySprint.get(task.sprintId)
    if (group) group.push(task)
    else tasksBySprint.set(task.sprintId, [task])
  }

  const orderedCheckins = [...input.checkins].sort(
    (a, b) => a.sprintId.localeCompare(b.sprintId) || a.userId.localeCompare(b.userId),
  )
  for (const checkin of orderedCheckins) {
    const sprint = sprintById.get(checkin.sprintId)
    if (!sprint) continue
    const computed = computeTaskProgress(
      (tasksBySprint.get(checkin.sprintId) ?? []).map((task) => ({
        assigneeId: task.assigneeId,
        status: task.status,
      })),
      checkin.userId,
    )
    const gap = checkinGap(checkin.percent, computed)
    // 'none' is agreement — nothing to raise. 'unknown' is NOT agreement and
    // is stated in words below rather than rendered like it (see checkins.ts).
    if (gap === 'none') continue
    const text = checkinAskText(checkin.percent, sprint.name, gap, computed.percent)
    addAsk(checkin.userId, {
      key: `checkin:${checkin.sprintId}:${checkin.userId}`,
      kind: 'checkin',
      appId: sprint.appId,
      text,
      context: checkinAskContext(gap),
      href: boardHref(appSlug(sprint.appId), sprint.sprintId, { who: checkin.userId }),
      linkLabel: 'Open their column',
      external: false,
      gap,
    })
  }

  // --- follow-ups owed from earlier meetings -------------------------------
  // Narrowed by the action layer to source meetings that share a project with
  // this one. When more than one is shared there is no defensible single
  // project to file it under, so it goes to the cross-project group rather
  // than being assigned to whichever name sorts first.
  for (const followup of [...input.followups].sort((a, b) => a.followupId.localeCompare(b.followupId))) {
    const shared = followup.sharedAppIds.filter((id) => projectById.has(id))
    addAsk(followup.userId, {
      key: `followup:${followup.followupId}`,
      kind: 'followup',
      appId: shared.length === 1 ? shared[0] : null,
      text: followup.text,
      context: `Still open from “${followup.sourceMeetingTitle}”`,
      href: `/print/meetings/${followup.sourceMeetingId}`,
      linkLabel: 'Open that meeting’s record',
      external: true,
    })
  }

  // --- project-level lines, addressed to a person --------------------------
  for (const project of projects) {
    const leadId = holderOf(project.appId, 'lead')
    const pmId = holderOf(project.appId, 'pm')

    // At-risk reasons go to whoever runs the project day to day — the lead
    // when there is one, otherwise the PM. Rendered VERBATIM: appHealth owns
    // the wording, and a second phrasing of the same verdict is a second
    // verdict a reader has to reconcile.
    const healthOwner = leadId ?? pmId
    if (healthOwner) {
      project.healthReasons.forEach((reason, index) => {
        addAsk(healthOwner, {
          key: `health:${project.appId}:${index}`,
          kind: 'health',
          appId: project.appId,
          text: reason,
          // PlanProjectRow carries the level, not the label — the label comes
          // from app-health.ts's own map, the same one used when the row is
          // built, so the two can never word the same verdict differently.
          context: `${HEALTH_LABEL[project.healthLevel]} — ${project.name}`,
          href: `/apps/${project.slug}`,
          linkLabel: 'Open the project',
          external: false,
        })
      })
    }

    if (!pmId) continue
    for (const sprint of runningSprints.filter((s) => s.appId === project.appId)) {
      const sprintTasks = tasksBySprint.get(sprint.sprintId) ?? []
      const unassigned = sprintTasks.filter(
        (task) => task.assigneeId === null && !isTerminal(task.status),
      ).length
      if (unassigned > 0) {
        addAsk(pmId, {
          key: `unassigned:${sprint.sprintId}`,
          kind: 'unassigned',
          appId: project.appId,
          text: `${plural(unassigned, 'task')} in ${sprint.name} with nobody on ${unassigned === 1 ? 'it' : 'them'}`,
          context: `${project.name} — nobody owns this yet`,
          href: boardHref(project.slug, sprint.sprintId, { who: UNASSIGNED_GROUP }),
          linkLabel: 'Open the unassigned column',
          external: false,
        })
      }
      // The honest stand-in for "blocked": task_status is
      // ('todo','in_progress','done') — there IS no blocked state in this
      // schema, and inventing one from a title keyword would put a word on
      // screen no row can back. Started, past its date, still not finished is
      // the thing the data can actually say.
      const stalled = stalledCount(sprintTasks, input.todayIso)
      if (stalled > 0) {
        addAsk(pmId, {
          key: `stalled:${sprint.sprintId}`,
          kind: 'stalled',
          appId: project.appId,
          text: stalledAskText(stalled, sprint.name),
          context: `${project.name} — moving slower than the dates say`,
          href: boardHref(project.slug, sprint.sprintId, { overdue: '1' }),
          linkLabel: 'Open the overdue filter',
          external: false,
        })
      }
    }
  }

  // --- candidates ----------------------------------------------------------
  const candidateIds = new Set<string>([...rolesByUser.keys(), ...asksByUser.keys()])
  const kindRank = new Map<AskKind, number>(ASK_KINDS.map((kind, index) => [kind, index] as const))
  const candidates: PlannerCandidate[] = []

  for (const userId of candidateIds) {
    const person = personById.get(userId)
    // A candidate with no users row cannot be named, and an unnamed row on a
    // "who should attend" list is noise rather than a suggestion.
    if (!person) continue
    const roles = rolesByUser.get(userId) ?? []
    const asks = (asksByUser.get(userId) ?? []).sort(
      (a, b) =>
        (kindRank.get(a.kind) ?? 0) - (kindRank.get(b.kind) ?? 0) || a.key.localeCompare(b.key),
    )
    candidates.push({
      userId,
      name: person.name,
      avatarUrl: person.avatarUrl,
      onInvite: attendeeIds.has(userId),
      roles,
      reason: candidateReason(roles, asks, appName),
      asks,
    })
  }

  // Role holders first (they are why the projects are on this agenda at all),
  // then whoever carries the most open work, then by name so the order is
  // total and never depends on map insertion.
  candidates.sort(
    (a, b) =>
      Number(b.roles.length > 0) - Number(a.roles.length > 0) ||
      b.asks.length - a.asks.length ||
      a.name.localeCompare(b.name),
  )

  return {
    projects: projects.map((project) => {
      const pmId = holderOf(project.appId, 'pm')
      const leadId = holderOf(project.appId, 'lead')
      return {
        appId: project.appId,
        name: project.name,
        slug: project.slug,
        healthLevel: project.healthLevel,
        healthLabel: HEALTH_LABEL[project.healthLevel],
        pmName: pmId ? (personById.get(pmId)?.name ?? null) : null,
        leadName: leadId ? (personById.get(leadId)?.name ?? null) : null,
        pmId: pmId ?? null,
        leadId: leadId ?? null,
      }
    }),
    candidates,
  }
}

/**
 * The agenda: the accepted people's surviving asks, grouped by project.
 *
 * Pure and re-run on every render from the CURRENT plan, so a line the
 * organiser accepted five minutes ago is gone the moment its task is ticked —
 * acceptance is a decision about a row, never a copy of the sentence.
 *
 * Groups are emitted in the plan's project order, and only when non-empty; the
 * cross-project bucket (a follow-up whose source meeting serves several of
 * these projects) sorts last because it is the exception, not a project.
 */
export type AgendaGroup = {
  /** Null for the cross-project bucket. */
  appId: string | null
  title: string
  entries: { candidate: PlannerCandidate; asks: PlannerAsk[] }[]
}

export function buildAgenda(
  plan: MeetingPlan,
  accepted: ReadonlySet<string>,
  droppedAskKeys: ReadonlySet<string>,
): AgendaGroup[] {
  const order = [...plan.projects.map((p) => p.appId), null]
  const title = (appId: string | null) =>
    appId === null
      ? 'Across these projects'
      : (plan.projects.find((p) => p.appId === appId)?.name ?? '')

  const groups: AgendaGroup[] = []
  for (const appId of order) {
    const entries: AgendaGroup['entries'] = []
    for (const candidate of plan.candidates) {
      if (!accepted.has(candidate.userId)) continue
      const asks = candidate.asks.filter(
        (ask) => ask.appId === appId && !droppedAskKeys.has(ask.key),
      )
      if (asks.length === 0) continue
      entries.push({ candidate, asks })
    }
    if (entries.length > 0) groups.push({ appId, title: title(appId), entries })
  }
  return groups
}
