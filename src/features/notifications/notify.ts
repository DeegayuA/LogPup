import { and, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveBugReports, liveMeetings, liveSprints, liveTasks } from '@/db/live'
import { appGrants, appRoleHistory, assignments, mentions, notifications, users } from '@/db/schema'
import {
  scopeSourceFor,
  type Actor,
  type EmploymentType,
  type UserRole,
} from '@/features/auth/capabilities'
import { isoDayOf } from '@/features/people/iso-day'
import { entityKindForSource, type MentionSource } from '@/features/notifications/entity-kinds'
import {
  classifyMention,
  mentionAdvisory,
  type SuppressedMention,
  type SuppressedReason,
} from '@/features/notifications/mention-rules'
import {
  OVERFLOW_HREF,
  OVERFLOW_KIND,
  OVERFLOW_TITLE_KEY,
  applyDailyCap,
  colomboDayWindow,
  dedupeKeyFor,
  dedupeRowStillBinds,
  mergeSameKey,
  recipientsFor,
  type DedupeTarget,
  type RecipientCandidate,
  type VisibilityGate,
} from '@/features/notifications/notify-rules'

/** The thing a notification is about, for liveness and for the click-through. */
export type NotificationEntity = { type: string; id: string }

export type NewNotification = {
  userId: string
  /** Who did it. Dropped from the recipients — see recipientsFor. */
  actorId?: string | null
  /** The LEGACY discriminator. Still NOT NULL; `kind` is what new rows mean. */
  type: 'mention' | 'meeting' | 'system'
  /**
   * The English fallback. Optional now: a row carrying `titleKey` renders from
   * the key at read time, and this column only exists for the rows written
   * before it did.
   */
  title?: string
  body?: string | null
  link?: string | null
  meetingId?: string | null
  /** What happened, as a string rather than an enum value needing a migration. */
  kind?: string
  titleKey?: string | null
  /**
   * IDS, NOT NAMES — actorId, appId, taskId. Freezing `actorName` into jsonb at
   * write time is how an inbox ends up asserting something that stopped being
   * true: a person is renamed and every historical row keeps the old label for
   * as long as it lives. Rendering resolves ids at READ time.
   */
  params?: Record<string, unknown> | null
  entity?: NotificationEntity | null
  /** Which of the two dedupe modes applies, and against what. */
  dedupe?: DedupeTarget | null
  /** The capability gating the entity. Null when the fact is about the person. */
  visibility?: VisibilityGate
}

/**
 * The one door every notification comes through.
 *
 * Filtering used to be each call site's problem, and no call site did it: a
 * deactivated contractor still accrued rows, a notification could point at a
 * trashed entity and 404 on click, and nothing anywhere could see that one
 * person was on the receiving end of a whole sprint's worth of events at once.
 * All of it lives here now — self-drop, eligibility, `can()`, entity liveness,
 * dedupe and the daily cap — because doing it in one function rather than
 * seven call sites is the property that stays true when the next spec adds
 * three more call sites.
 *
 * BEST EFFORT, and it must stay that way: this is called after the write it
 * describes has already succeeded, so a failure here must never be what
 * reports a saved comment as failed. Nothing thrown from inside escapes.
 *
 * `now` is a parameter so a caller with a fixed clock gets a fixed day; the
 * cap is spent per Asia/Colombo calendar day and a batch that asked the clock
 * twice could straddle midnight.
 */
export async function createNotifications(
  rows: NewNotification[],
  now: Date = new Date(),
): Promise<void> {
  try {
    const valid = rows.filter((r) => r.userId)
    if (valid.length === 0) return

    const withLiveEntities = await dropDeadEntities(valid)
    if (withLiveEntities.length === 0) return

    const allowed = await dropIneligibleRecipients(withLiveEntities)
    if (allowed.length === 0) return

    const built = mergeInBatch(allowed.map(toInsertRow))
    const dayIso = isoDayOf(now)
    const toWrite = await applyCap(built, dayIso)
    await insertAll(toWrite)
  } catch (error) {
    // Swallowed on purpose, and logged rather than rethrown: see the docblock.
    console.error('[notifications] createNotifications failed:', error)
  }
}

// --- the row we actually insert ---------------------------------------------

type InsertRow = {
  userId: string
  actorId: string | null
  type: 'mention' | 'meeting' | 'system'
  title: string
  body: string | null
  link: string | null
  meetingId: string | null
  kind: string
  titleKey: string | null
  params: Record<string, unknown> | null
  entityType: string | null
  entityId: string | null
  dedupeKey: string | null
  dedupePermanent: boolean
  collapseCount: number
}

function toInsertRow(row: NewNotification): InsertRow {
  const dedupe = row.dedupe ? dedupeKeyFor(row.dedupe) : null
  return {
    userId: row.userId,
    actorId: row.actorId ?? null,
    type: row.type,
    // `title` is still NOT NULL on this table — migration 0057 deliberately did
    // not convert a live column on a database several sessions share — so a
    // key-only row has to put something here. The key names itself rather than
    // inventing a sentence, because a sentence written now is exactly the
    // stored-English problem title_key exists to end.
    title: row.title ?? row.titleKey ?? row.kind ?? row.type,
    body: row.body ?? null,
    link: row.link ?? null,
    meetingId: row.meetingId ?? null,
    // Defaulting to `type` rather than to 'legacy': that is precisely what
    // migration 0057 backfilled the existing rows to, so a caller that has not
    // named a kind yet lands in the same bucket its history did.
    kind: row.kind ?? row.type,
    titleKey: row.titleKey ?? null,
    params: row.params ?? null,
    entityType: row.entity?.type ?? null,
    entityId: row.entity?.id ?? null,
    dedupeKey: dedupe?.key ?? null,
    dedupePermanent: dedupe?.permanent ?? false,
    collapseCount: 1,
  }
}

/**
 * Collapse duplicates INSIDE this batch before either the cap or Postgres sees
 * them.
 *
 * Before the cap on purpose: two mentions of the same person on the same task
 * are one row, and letting them spend two of that person's five would be the
 * cap punishing somebody for a duplicate that was never going to be written.
 */
function mergeInBatch(rows: InsertRow[]): InsertRow[] {
  return mergeSameKey(rows).map((row) =>
    // A permanent key is one row per person per key, ever — there is nothing
    // to count. Leaving the merged sum on it would print "3" on a single
    // escalation rung that fired once.
    row.dedupePermanent ? { ...row, collapseCount: 1 } : row,
  )
}

// --- drop rows whose entity is already gone ---------------------------------

/**
 * Ids from `ids` that still exist and are not soft-deleted.
 *
 * Written out per type rather than through a lookup table, for the reason
 * live.ts gives for the same shape: each branch gets its own column types, and
 * a type this codebase does not soft-delete (a comment, a user) falls through
 * to "all of them", which is the honest answer rather than a silent drop.
 */
async function liveEntityIds(entityType: string, ids: string[]): Promise<string[]> {
  switch (entityType) {
    case 'task':
      return (await db.select({ id: liveTasks.id }).from(liveTasks).where(inArray(liveTasks.id, ids)))
        .map((r) => r.id)
    case 'app':
      return (await db.select({ id: liveApps.id }).from(liveApps).where(inArray(liveApps.id, ids)))
        .map((r) => r.id)
    case 'meeting':
      return (await db.select({ id: liveMeetings.id }).from(liveMeetings).where(inArray(liveMeetings.id, ids)))
        .map((r) => r.id)
    case 'bug':
      return (await db.select({ id: liveBugReports.id }).from(liveBugReports).where(inArray(liveBugReports.id, ids)))
        .map((r) => r.id)
    case 'sprint':
      return (await db.select({ id: liveSprints.id }).from(liveSprints).where(inArray(liveSprints.id, ids)))
        .map((r) => r.id)
    default:
      return ids
  }
}

/**
 * A notification pointing at a trashed entity is a row whose only affordance
 * 404s. The row itself is allowed to outlive its target — that is why
 * entity_id carries no foreign key — but there is no reason to MINT one for
 * something already in the trash.
 *
 * `meetingId` is not checked here: queries.ts already hides a notification
 * whose meeting is trashed at read time, and paying for a second lookup on
 * every meeting invite to reach the same answer buys nothing.
 */
async function dropDeadEntities(rows: NewNotification[]): Promise<NewNotification[]> {
  const wanted = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.entity) continue
    const ids = wanted.get(row.entity.type) ?? new Set<string>()
    ids.add(row.entity.id)
    wanted.set(row.entity.type, ids)
  }
  if (wanted.size === 0) return rows

  const alive = new Set<string>()
  for (const [entityType, ids] of wanted) {
    for (const id of await liveEntityIds(entityType, [...ids])) alive.add(`${entityType} ${id}`)
  }
  return rows.filter((row) => !row.entity || alive.has(`${row.entity.type} ${row.entity.id}`))
}

// --- drop recipients who may not have it ------------------------------------

type Person = {
  id: string
  role: UserRole
  employmentType: EmploymentType | null
  active: boolean
  approved: boolean
}

/**
 * The apps each of these people reaches, by the source their seat draws scope
 * from — the batched form of loadActor's single-actor read, with the same
 * three sources for the same reasons.
 *
 * Only the people a gated row names are resolved: an announcement to the whole
 * studio gates on nothing, and resolving forty people's project membership to
 * decide a question nobody asked is how a notification write starts costing
 * more than the write it describes.
 */
async function loadScopes(people: Person[]): Promise<Map<string, Set<string>>> {
  const scopes = new Map<string, Set<string>>()
  const byManagedApps: string[] = []
  const byAssignment: string[] = []
  const byGrant: string[] = []
  for (const person of people) {
    scopes.set(person.id, new Set())
    switch (scopeSourceFor(person.role)) {
      case 'app_role_history': byManagedApps.push(person.id); break
      case 'assignments': byAssignment.push(person.id); break
      case 'app_grants': byGrant.push(person.id); break
      case 'none': break
    }
  }

  const add = (userId: string, appId: string) => scopes.get(userId)?.add(appId)

  if (byManagedApps.length > 0) {
    const rows = await db
      .select({ userId: appRoleHistory.userId, appId: appRoleHistory.appId })
      .from(appRoleHistory)
      .where(
        and(
          inArray(appRoleHistory.userId, byManagedApps),
          isNull(appRoleHistory.effectiveTo),
          inArray(appRoleHistory.role, ['pm', 'lead']),
        ),
      )
    for (const row of rows) add(row.userId, row.appId)
  }
  if (byAssignment.length > 0) {
    const rows = await db
      .select({ userId: assignments.userId, appId: assignments.appId })
      .from(assignments)
      .where(inArray(assignments.userId, byAssignment))
    for (const row of rows) add(row.userId, row.appId)
  }
  if (byGrant.length > 0) {
    const rows = await db
      .select({ userId: appGrants.userId, appId: appGrants.appId })
      .from(appGrants)
      .where(inArray(appGrants.userId, byGrant))
    for (const row of rows) add(row.userId, row.appId)
  }
  return scopes
}

/** The key that makes two rows share one recipient decision. */
function gateKey(row: NewNotification): string {
  const gate = row.visibility ?? null
  return JSON.stringify([row.actorId ?? null, gate?.action ?? null, gate?.resource ?? null])
}

async function dropIneligibleRecipients(rows: NewNotification[]): Promise<NewNotification[]> {
  const userIds = [...new Set(rows.map((r) => r.userId))]
  const people: Person[] = (
    await db
      .select({
        id: users.id,
        role: users.role,
        employmentType: users.employmentType,
        active: users.active,
        status: users.status,
      })
      .from(users)
      .where(inArray(users.id, userIds))
  ).map((row) => ({
    id: row.id,
    role: row.role,
    employmentType: row.employmentType,
    active: row.active,
    approved: row.status === 'approved',
  }))

  const gatedIds = new Set(rows.filter((r) => r.visibility).map((r) => r.userId))
  const scopes = gatedIds.size > 0
    ? await loadScopes(people.filter((p) => gatedIds.has(p.id)))
    : new Map<string, Set<string>>()

  const candidates = new Map<string, RecipientCandidate>()
  for (const person of people) {
    const actor: Actor = {
      id: person.id,
      role: person.role,
      employmentType: person.employmentType ?? undefined,
      scopeAppIds: scopes.get(person.id) ?? new Set(),
    }
    candidates.set(person.id, { actor, active: person.active, approved: person.approved })
  }

  // Grouped by (actor, gate) rather than decided per row: every row in one
  // call almost always shares both, so this is one pure pass over the batch
  // instead of one per notification.
  const groups = new Map<string, NewNotification[]>()
  for (const row of rows) {
    const key = gateKey(row)
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const kept: NewNotification[] = []
  for (const group of groups.values()) {
    const eligible = new Set(
      recipientsFor({
        candidates: [...new Set(group.map((r) => r.userId))]
          .map((id) => candidates.get(id))
          .filter((c): c is RecipientCandidate => c !== undefined),
        actorId: group[0].actorId ?? null,
        visibility: group[0].visibility ?? null,
      }),
    )
    for (const row of group) if (eligible.has(row.userId)) kept.push(row)
  }
  return kept
}

// --- dedupe state and the cap -----------------------------------------------

/**
 * Which of these rows land on a dedupe row that still exists.
 *
 * They are exempt from the cap, and that is the point of asking: an event
 * collapsing into a row somebody already has creates no new row, so charging
 * it a slot would let a re-run of the daily tick spend five of somebody's five
 * on rows it never writes and then mint an overflow row counting events that
 * each already have one.
 */
async function findBindingDedupeRows(rows: InsertRow[]): Promise<Set<string>> {
  const keyed = rows.filter((r) => r.dedupeKey !== null)
  const binding = new Set<string>()
  if (keyed.length === 0) return binding

  const existing = await db
    .select({
      userId: notifications.userId,
      dedupeKey: notifications.dedupeKey,
      permanent: notifications.dedupePermanent,
      read: notifications.read,
      dismissedAt: notifications.dismissedAt,
    })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userId, [...new Set(keyed.map((r) => r.userId))]),
        inArray(notifications.dedupeKey, [...new Set(keyed.map((r) => r.dedupeKey as string))]),
      ),
    )

  for (const row of existing) {
    if (row.dedupeKey === null) continue
    const stillBinds = dedupeRowStillBinds({
      permanent: row.permanent,
      read: row.read,
      dismissed: row.dismissedAt !== null,
    })
    if (stillBinds) binding.add(`${row.userId} ${row.dedupeKey} ${row.permanent}`)
  }
  return binding
}

/** Immediate rows already written to each of these people today. */
async function countToday(userIds: string[], dayIso: string): Promise<Map<string, number>> {
  const { from, to } = colomboDayWindow(dayIso)
  const rows = await db
    .select({ userId: notifications.userId, spent: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userId, userIds),
        gte(notifications.createdAt, from),
        lt(notifications.createdAt, to),
        // The overflow row is the cap's own bookkeeping. Counting it would let
        // one overflow push the day's next real notification into a second.
        ne(notifications.kind, OVERFLOW_KIND),
      ),
    )
    .groupBy(notifications.userId)
  return new Map(rows.map((r) => [r.userId, r.spent]))
}

/**
 * How many events each person's live overflow row already stands for.
 *
 * Scoped to unread and undismissed because that is the row the upsert will
 * actually find: once somebody has cleared today's overflow, the next
 * suppressed event opens a fresh one starting at zero rather than resuming a
 * number they have already dealt with.
 */
async function overflowSoFar(userIds: string[], dayIso: string): Promise<Map<string, number>> {
  const { from, to } = colomboDayWindow(dayIso)
  const rows = await db
    .select({ userId: notifications.userId, collapseCount: notifications.collapseCount })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userId, userIds),
        eq(notifications.kind, OVERFLOW_KIND),
        eq(notifications.read, false),
        isNull(notifications.dismissedAt),
        gte(notifications.createdAt, from),
        lt(notifications.createdAt, to),
      ),
    )
  return new Map(rows.map((r) => [r.userId, r.collapseCount]))
}

function overflowRow(
  userId: string,
  key: string,
  increment: number,
  params: { count: number; href: string },
): InsertRow {
  return {
    userId,
    // No actor: the cap suppressed these, not a person.
    actorId: null,
    type: 'system',
    // Deliberately carries no number. `collapse_count` and params.count are the
    // count, and both move; a number frozen into this fallback string would be
    // wrong from the second event onwards.
    title: 'More updates today',
    body: null,
    link: params.href,
    meetingId: null,
    kind: OVERFLOW_KIND,
    titleKey: OVERFLOW_TITLE_KEY,
    params,
    entityType: null,
    entityId: null,
    dedupeKey: key,
    dedupePermanent: false,
    collapseCount: increment,
  }
}

async function applyCap(rows: InsertRow[], dayIso: string): Promise<InsertRow[]> {
  const binding = await findBindingDedupeRows(rows)
  const collapsing: InsertRow[] = []
  const fresh: InsertRow[] = []
  for (const row of rows) {
    const bindsToExisting =
      row.dedupeKey !== null && binding.has(`${row.userId} ${row.dedupeKey} ${row.dedupePermanent}`)
    if (bindsToExisting) collapsing.push(row)
    else fresh.push(row)
  }
  if (fresh.length === 0) return collapsing

  // Per PERSON, because the budget is per person: two people each getting six
  // events is two ordinary days, not one capped one.
  const perUser = new Map<string, InsertRow[]>()
  for (const row of fresh) perUser.set(row.userId, [...(perUser.get(row.userId) ?? []), row])

  const userIds = [...perUser.keys()]
  const [spent, overflowing] = await Promise.all([
    countToday(userIds, dayIso),
    overflowSoFar(userIds, dayIso),
  ])

  const out = [...collapsing]
  for (const [userId, candidates] of perUser) {
    const outcome = applyDailyCap({
      userId,
      dayIso,
      alreadyToday: spent.get(userId) ?? 0,
      overflowSoFar: overflowing.get(userId) ?? 0,
      candidates,
      href: OVERFLOW_HREF,
    })
    out.push(...outcome.immediate)
    if (outcome.overflow) {
      out.push(
        overflowRow(userId, outcome.overflow.key, outcome.overflow.increment, outcome.overflow.params),
      )
    }
  }
  return out
}

// --- the two upserts --------------------------------------------------------

/**
 * The arbiters, spelled exactly as migration 0057 spells the two partial
 * unique indexes. Postgres only picks a partial index for ON CONFLICT when the
 * clause implies the index predicate, so a paraphrase here is not a style
 * difference — it is "there is no unique or exclusion constraint matching the
 * ON CONFLICT specification" at runtime, on a write path that swallows its own
 * errors.
 */
const permanentArbiter = () => sql`${notifications.dedupePermanent}`
const collapsingArbiter = () =>
  sql`not ${notifications.dedupePermanent} and ${notifications.read} = false and ${notifications.dismissedAt} is null`

async function insertAll(rows: InsertRow[]): Promise<void> {
  if (rows.length === 0) return
  const permanent = rows.filter((r) => r.dedupePermanent)
  const collapsing = rows.filter((r) => !r.dedupePermanent)

  if (permanent.length > 0) {
    // An escalation ladder: one row per (person, key), ever. A re-run of the
    // daily tick finds every rung already there and writes nothing.
    await db.insert(notifications).values(permanent).onConflictDoNothing({
      target: [notifications.userId, notifications.dedupeKey],
      where: permanentArbiter(),
    })
  }

  if (collapsing.length > 0) {
    // Comments, mentions, accepted suggestions, and the overflow row. The
    // count climbs while the row is unread; once it is read or dismissed it
    // leaves the index and the next event opens a fresh row at one. Rows with
    // no dedupe key never conflict at all — a unique index does not equate
    // nulls — so they ride along in the same statement.
    await db
      .insert(notifications)
      .values(collapsing)
      .onConflictDoUpdate({
        target: [notifications.userId, notifications.dedupeKey],
        targetWhere: collapsingArbiter(),
        set: {
          // The increment travels ON THE ROW rather than as a constant: one
          // statement carries many rows and each may stand for a different
          // number of events, which a shared `+ 1` could not express.
          collapseCount: sql`${notifications.collapseCount} + excluded.collapse_count`,
          // A collapsed row describes the most recent event, and it belongs at
          // the top of the bell rather than wherever the first one landed.
          createdAt: sql`now()`,
          actorId: sql`excluded.actor_id`,
          title: sql`excluded.title`,
          body: sql`excluded.body`,
          link: sql`excluded.link`,
          titleKey: sql`excluded.title_key`,
          // params.count is kept equal to collapse_count by the database, so a
          // renderer reading either gets the same number. Recomputed here
          // rather than taken from the incoming row because the incoming
          // number came from a read that another writer may already have
          // moved past.
          params: sql`jsonb_set(coalesce(excluded.params, '{}'::jsonb), '{count}', to_jsonb(${notifications.collapseCount} + excluded.collapse_count))`,
        },
      })
  }
}

// --- mentions ---------------------------------------------------------------

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Mentions are stored as plain "@Name" text (see mention-textarea.tsx), so we
// match each known user's name as a whole @token. Longest names first prevents a
// short name ("@Sam") from matching inside a longer one ("@Samantha").
export function extractMentionedUserIds(
  text: string,
  known: { id: string; name: string }[],
): string[] {
  if (!text.includes('@')) return []
  const matched = new Set<string>()
  const byLength = [...known].sort((a, b) => b.name.length - a.name.length)
  for (const user of byLength) {
    const re = new RegExp(`(^|\\s)@${escapeRegExp(user.name)}(?=\\s|$|[.,!?;:])`, 'i')
    if (re.test(text)) matched.add(user.id)
  }
  return [...matched]
}

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

/** One person named in a body of text. */
export type MentionTarget = { userId: string; name: string }

export type RecordMentionsInput = {
  source: MentionSource
  sourceId: string
  /** Denormalised onto the row so an orphaned mention still reads as a sentence. */
  sourceLabel: string
  actorId: string
  /** Null for a source that belongs to no project, e.g. a worklog note. */
  appId: string | null
  mentioned: readonly MentionTarget[]
  /** Where the bell row points. */
  link: string | null
  /** Ids this action is also OFFERING the task to — see 'assignment_supersedes'. */
  assignedTo?: readonly string[]
}

export type RecordMentionsResult = {
  /** Names that got a bell row. */
  notified: string[]
  suppressed: SuppressedMention[]
  /** One sentence for the author, or null. Non-fatal — show it beside success. */
  advisory: string | null
}

const NO_MENTIONS: RecordMentionsResult = { notified: [], suppressed: [], advisory: null }

/**
 * Record who was named, and notify the ones it can reach.
 *
 * NOTIFIES EXACTLY ONCE, EVER, and the guarantee is the unique index rather
 * than anything in this function. The insert is `onConflictDoNothing().
 * returning()`, so a row already present comes back as NOTHING — and only rows
 * that came back are notified. Re-running extraction over an edited body
 * therefore notifies nobody, however many times it runs, and no caller has to
 * remember that.
 *
 * That is a DIFFERENT guarantee from the collapsing dedupe on notifications,
 * and both are load-bearing: see the comment on `mentions_source_user_idx`.
 *
 * EVERY NAMED PERSON GETS A ROW, delivered or not. A suppressed mention is
 * recorded with its reason and reported back to the author — the row is the
 * record that they said it, and the advisory is what stops them believing it
 * arrived.
 *
 * Failures are swallowed and logged, like `createNotifications` above: a
 * mention that could not be recorded must not fail the comment it was written
 * in. The caller has already saved.
 */
export async function recordMentions(
  input: RecordMentionsInput,
): Promise<RecordMentionsResult> {
  if (input.mentioned.length === 0) return NO_MENTIONS

  try {
    // Deduped by id first: the same person named twice in one body is one
    // mention, and without this the insert would conflict with itself.
    const targets = [...new Map(input.mentioned.map((m) => [m.userId, m])).values()]
    const assigned = new Set(input.assignedTo ?? [])

    const people = await db
      .select({
        id: users.id,
        role: users.role,
        employmentType: users.employmentType,
        active: users.active,
        status: users.status,
      })
      .from(users)
      .where(inArray(users.id, targets.map((target) => target.userId)))

    const byId = new Map(people.map((person) => [person.id, person]))

    // Scope is only a question when the source belongs to a project. A worklog
    // note is nobody's project, and treating "no project" as "no access" would
    // suppress every mention written outside one.
    const scopes = input.appId
      ? await loadScopes(
          people.map((person) => ({
            id: person.id,
            role: person.role,
            employmentType: person.employmentType,
            active: person.active,
            approved: person.status === 'approved',
          })),
        )
      : new Map<string, Set<string>>()

    const rows = targets.map((target) => {
      const person = byId.get(target.userId)
      const reason = classifyMention({
        isSelf: target.userId === input.actorId,
        // A person the read did not return is not a person: unknown id, or a
        // row removed between the mention being typed and this running.
        isActive: person?.active ?? false,
        isApproved: person?.status === 'approved',
        hasAccess:
          input.appId === null
          || (scopes.get(target.userId)?.has(input.appId) ?? false)
          // No scope entry at all means the seat is not scope-limited, which
          // loadScopes expresses by omission rather than by a full set.
          || !scopes.has(target.userId),
        supersededByAssignment: assigned.has(target.userId),
      })
      return { target, reason }
    })

    const inserted = await db
      .insert(mentions)
      .values(
        rows.map(({ target, reason }) => ({
          sourceType: input.source,
          sourceId: input.sourceId,
          sourceLabel: input.sourceLabel,
          mentionedUserId: target.userId,
          actorId: input.actorId,
          appId: input.appId,
          notified: reason === null,
          suppressedReason: reason,
        })),
      )
      // THE ANTI-SPAM MECHANISM, exercised. A body edited four times inserts
      // once; the other three return no rows and notify nobody.
      .onConflictDoNothing()
      .returning({ mentionedUserId: mentions.mentionedUserId })

    const freshlyRecorded = new Set(inserted.map((row) => row.mentionedUserId))
    const deliverable = rows.filter(
      (row) => row.reason === null && freshlyRecorded.has(row.target.userId),
    )

    if (deliverable.length > 0) {
      await createNotifications(
        deliverable.map(({ target }) => ({
          userId: target.userId,
          actorId: input.actorId,
          type: 'mention' as const,
          kind: 'mention',
          title: `${input.sourceLabel}`,
          link: input.link,
          entity: { type: entityKindForSource(input.source), id: input.sourceId },
          // Collapsing rather than a ladder: three mentions across one app's
          // comments are one bell row reading "3 mentions", and the next one
          // after they read it opens a fresh row.
          dedupe: {
            mode: 'entity' as const,
            entityType: entityKindForSource(input.source),
            entityId: input.sourceId,
            event: 'mention',
          },
          // The capability that gates the SOURCE, so a bell row can never open
          // a page its reader may not see. Null when the source belongs to no
          // project — there is nothing to be scoped out of.
          visibility: input.appId ? { action: 'app.view' as const, resource: { appId: input.appId } } : null,
        })),
      )
    }

    // Reported on EVERY run, not only the first. Somebody who fixes a typo and
    // saves again should be told again that Nuwan still cannot see it — the
    // once-ever rule is about notifying the recipient, not about informing the
    // author.
    const suppressed = rows
      .filter((row) => row.reason !== null)
      .map((row) => ({ name: row.target.name, reason: row.reason as SuppressedReason }))

    return {
      notified: deliverable.map(({ target }) => target.name),
      suppressed,
      advisory: mentionAdvisory(suppressed, input.sourceLabel),
    }
  } catch (error) {
    // A mention that could not be recorded must not fail the comment it was
    // written in — the caller has already saved.
    console.error('[notifications] recordMentions failed:', error)
    return NO_MENTIONS
  }
}
