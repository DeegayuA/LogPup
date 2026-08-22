import { can, type Action, type Actor, type Resource } from '@/features/auth/capabilities'
import { workingDayFraction } from '@/lib/working-days'

/**
 * Every decision `createNotifications` makes, with no database and no clock.
 *
 * PURE by construction — no `@/db`, no `new Date()`. The day arrives as
 * `dayIso` (Asia/Colombo, resolved once by the caller) for the same reason
 * src/features/intel/signals.ts takes `todayIso`: a cap that asked the clock
 * for itself could straddle midnight halfway through a batch and spend two
 * days' budget on one burst.
 *
 * These rules are a module rather than lines inside the write path because
 * volume is the failure the whole substrate is built against
 * (docs/superpowers/specs/2026-08-20-work-substrate-design.md). A ceiling that
 * lives only inside an async function nobody can run without a database is a
 * ceiling nobody can test, and every spec after this one adds a kind that
 * spends against it.
 */

// --- dedupe -----------------------------------------------------------------

/**
 * Which of the two partial unique indexes a key lands in.
 *
 * NOT a boolean a call site passes in. The mode follows from the SHAPE of what
 * is being deduplicated, so a caller cannot ask for a ladder and get
 * collapsing semantics: a ladder rung is one row per person per rung, ever,
 * and a comment on a task is one row that counts up while unread. Getting
 * those two the wrong way round is silent — the row still appears — and the
 * damage (a nag that repeats every tick, or an escalation that fires once and
 * never again) only shows up in somebody's bell days later.
 */
export type DedupeTarget =
  /**
   * An escalation ladder. `armedOn` is the fact the rung is about — a due
   * date — so a legitimately moved date re-arms the ladder while a re-run of
   * the daily tick fires nothing at all.
   */
  | { mode: 'ladder'; ladder: string; entityId: string; step: string; armedOn: string }
  /**
   * Collapse on the ENTITY, never the event: five comments on one task are one
   * row reading "5 new comments", not five rows.
   */
  | { mode: 'entity'; entityType: string; entityId: string; event: string }
  /** The one row a capped day gets in place of everything past the cap. */
  | { mode: 'overflow'; userId: string; dayIso: string }

export type DedupeSpec = {
  key: string
  /** Mirrors `notifications.dedupe_permanent`; picks the arbiter index. */
  permanent: boolean
}

// A key is parsed by nobody, but it IS compared by a unique index, so a
// separator inside a segment would let two different events share one key
// ("task:a:b" + event "c" against "task:a" + event "b:c"). Ids are uuids and
// steps/events are slugs, so anything else here is a bug at the call site, and
// throwing is how it gets found in a test rather than in somebody's inbox.
const SEGMENT = /^[A-Za-z0-9._-]+$/

function segment(value: string, field: string): string {
  if (!SEGMENT.test(value)) {
    throw new RangeError(
      `notification dedupe ${field} must be a plain token, got ${JSON.stringify(value)}`,
    )
  }
  return value
}

/** The dedupe key for `target`, and which of the two dedupe modes it uses. */
export function dedupeKeyFor(target: DedupeTarget): DedupeSpec {
  switch (target.mode) {
    case 'ladder':
      return {
        key: [
          segment(target.ladder, 'ladder'),
          segment(target.entityId, 'entityId'),
          segment(target.step, 'step'),
          segment(target.armedOn, 'armedOn'),
        ].join(':'),
        permanent: true,
      }
    case 'entity':
      return {
        key: [
          segment(target.entityType, 'entityType'),
          segment(target.entityId, 'entityId'),
          segment(target.event, 'event'),
        ].join(':'),
        permanent: false,
      }
    case 'overflow':
      return {
        key: `notif:overflow:${segment(target.userId, 'userId')}:${segment(target.dayIso, 'dayIso')}`,
        permanent: false,
      }
  }
}

/** An existing row the write path found for a (user, dedupe key) pair. */
export type ExistingDedupeRow = {
  permanent: boolean
  read: boolean
  dismissed: boolean
}

/**
 * Is this row still the one a new event collapses into, or does the event open
 * a fresh one?
 *
 * The two arms below are migration 0057's two partial unique indexes written
 * out in JavaScript, and they must stay identical to them: if this drifts, the
 * write path and the database disagree about whether a row exists, and the
 * upsert either writes a second row or silently increments one the reader has
 * already cleared.
 *
 * The collapsing arm is where "5 new comments" RESETS. Once the reader has
 * read or dismissed the row it leaves the index, and the next comment opens a
 * fresh row starting at one — which is the point: a counter that kept climbing
 * past a read would tell somebody who is caught up that they are nineteen
 * behind.
 */
export function dedupeRowStillBinds(row: ExistingDedupeRow): boolean {
  if (row.permanent) return true
  return !row.read && !row.dismissed
}

/** A row on its way into `notifications`, as far as deduplication cares. */
export type DedupedRow = {
  userId: string
  dedupeKey: string | null
  /** How many events this row stands for; summed when two rows merge. */
  collapseCount: number
}

/**
 * Collapse rows sharing a (user, key) inside ONE batch before it reaches
 * Postgres.
 *
 * Not a tidy-up. `INSERT ... ON CONFLICT DO UPDATE` raises "ON CONFLICT DO
 * UPDATE command cannot affect row a second time" when two values rows in the
 * same statement conflict with each other, and that takes down the whole
 * batch — every notification in it, not just the duplicate.
 *
 * The LAST row wins on everything but the count, because a collapsed row
 * describes the most recent event, and the counts add up so no event is lost
 * in the merge.
 */
export function mergeSameKey<T extends DedupedRow>(rows: readonly T[]): T[] {
  const merged: T[] = []
  const at = new Map<string, number>()
  for (const row of rows) {
    if (row.dedupeKey === null) {
      // A null key never conflicts — a unique index does not equate nulls — so
      // an unkeyed row is always a row of its own.
      merged.push(row)
      continue
    }
    const id = `${row.userId} ${row.dedupeKey}`
    const seen = at.get(id)
    if (seen === undefined) {
      at.set(id, merged.length)
      merged.push(row)
      continue
    }
    merged[seen] = { ...row, collapseCount: merged[seen].collapseCount + row.collapseCount }
  }
  return merged
}

// --- who may receive it -----------------------------------------------------

export type RecipientCandidate = {
  actor: Actor
  /** `users.active`. A deactivated person keeps a session and may not act. */
  active: boolean
  /** `users.status === 'approved'`. A pending self-signup is not staff yet. */
  approved: boolean
}

/**
 * The capability gating the thing a notification is about, or null.
 *
 * Null means the fact is about the PERSON rather than about an entity they
 * might not reach — a maintenance notice is the live case. Written as an
 * explicit null rather than an omission so "this kind has no entity" reads as
 * a decision somebody made rather than one they forgot.
 */
export type VisibilityGate = { action: Action; resource?: Resource } | null

/**
 * Who, of these candidates, actually gets the row.
 *
 * Three drops, and every one of them was live before this function existed:
 * the actor themself (nobody is notified about their own action), anyone
 * deactivated or still awaiting approval (a contractor who left kept accruing
 * rows and stayed mentionable), and anyone the entity is not visible to. That
 * last one is `can()` because a notification is a read of the thing it names,
 * and one that opens a page the reader may not see is a permission leak that
 * arrives by itself.
 *
 * Ids come back in input order, each at most once: two mentions of the same
 * person in one comment is one person, not two rows.
 */
export function recipientsFor(input: {
  candidates: readonly RecipientCandidate[]
  /** Who did the thing. Null for anything the system did on its own. */
  actorId?: string | null
  visibility: VisibilityGate
}): string[] {
  const kept: string[] = []
  const seen = new Set<string>()
  for (const candidate of input.candidates) {
    const id = candidate.actor.id
    if (!id || seen.has(id)) continue
    if (input.actorId && id === input.actorId) continue
    if (!candidate.active || !candidate.approved) continue
    const gate = input.visibility
    if (gate && !can(candidate.actor, gate.action, gate.resource)) continue
    seen.add(id)
    kept.push(id)
  }
  return kept
}

// --- the daily cap ----------------------------------------------------------

/**
 * At most five immediate in-app notifications per person per weekday — the
 * budget table in the spec, made mechanism.
 *
 * The number lives here and nowhere else on purpose. A ceiling stated as prose
 * inside a feature spec is one every later spec forgets; a ceiling inside the
 * one function every kind passes through survives the kinds nobody has scoped
 * yet. It is also the only thing that bounds a BURST: an escalation ladder
 * keys on a due date, so one sprint slip touching twenty tasks legitimately
 * re-arms twenty ladders on the next tick, and no per-kind rule anywhere can
 * see that the same person is on the receiving end of all of them.
 */
export const DAILY_NOTIFICATION_CAP = 5

/** What the overflow row says. Rendered at read time, like every title_key. */
export const OVERFLOW_TITLE_KEY = 'notif.overflow.more'

/**
 * `kind` on the overflow row, so the cap can count a person's day without
 * counting its own bookkeeping. An overflow row that spent a slot would push
 * the next real notification of the day into a second overflow.
 */
export const OVERFLOW_KIND = 'notification.overflow'

/**
 * The dashboard, because its notifications card is the only surface that lists
 * these today. Spec D's day-filtered inbox replaces this one constant — a link
 * to a route that does not exist yet is worse than a link to the list the rows
 * are actually on.
 */
export const OVERFLOW_HREF = '/'

/**
 * How many immediate rows `dayIso` is worth.
 *
 * Five is the weekday number. A day the studio does not fully work is not
 * worth five interruptions, so the budget follows `workingDayFraction` — three
 * on a Saturday half day, one on a Sunday or a mercantile holiday. Never zero:
 * a cap of zero turns a lone Sunday notification into an overflow row reading
 * "1 more", which costs the same row and says less than the fact it replaced.
 * The floor is what keeps the overflow row a door rather than a tombstone.
 */
export function dailyCapFor(dayIso: string, isHoliday?: (iso: string) => boolean): number {
  const fraction = workingDayFraction(dayIso, isHoliday)
  return Math.max(1, Math.ceil(DAILY_NOTIFICATION_CAP * fraction))
}

export type OverflowRow = {
  key: string
  /** Events suppressed by THIS call — what `collapse_count` goes up by. */
  increment: number
  /** IDS AND NUMBERS ONLY, like every other params bag here. */
  params: { count: number; href: string }
}

export type CapOutcome<T> = {
  /** Rows written as themselves. */
  immediate: T[]
  /** Rows that collapse into `overflow` instead. Never dropped silently. */
  suppressed: T[]
  overflow: OverflowRow | null
}

/**
 * Split one person's candidates into the ones that get their own row and the
 * ones that collapse into a single overflow row.
 *
 * Overflow COLLAPSES; it never drops. The count is real and the row is a door:
 * silently discarding the sixth event of a day is the failure this cap exists
 * to prevent, not a cheaper version of it. Each suppressed fact also still
 * sits on its own surface — the task, the board, the promises list — so a
 * capped day loses the interruption and not the information.
 */
export function applyDailyCap<T>(input: {
  userId: string
  dayIso: string
  /** Immediate rows this person has already been written today. */
  alreadyToday: number
  /** `collapse_count` already on today's overflow row; 0 when there is none. */
  overflowSoFar?: number
  candidates: readonly T[]
  href?: string
  isHoliday?: (iso: string) => boolean
}): CapOutcome<T> {
  const cap = dailyCapFor(input.dayIso, input.isHoliday)
  const room = Math.max(0, cap - input.alreadyToday)
  const immediate = input.candidates.slice(0, room)
  const suppressed = input.candidates.slice(room)
  if (suppressed.length === 0) return { immediate, suppressed, overflow: null }
  return {
    immediate,
    suppressed,
    overflow: {
      key: dedupeKeyFor({ mode: 'overflow', userId: input.userId, dayIso: input.dayIso }).key,
      increment: suppressed.length,
      params: {
        // The cumulative number of events suppressed today, so the seventh
        // event of a day increments the row the sixth opened rather than
        // opening a second one. Postgres recomputes this from `collapse_count`
        // on conflict; this value is what a FRESH row starts at.
        count: (input.overflowSoFar ?? 0) + suppressed.length,
        href: input.href ?? OVERFLOW_HREF,
      },
    },
  }
}

// --- the day, as a window over an instant column ----------------------------

/**
 * The half-open UTC window covering `dayIso` in Asia/Colombo.
 *
 * The cap counts rows by `notifications.created_at`, which is an instant,
 * while the budget is spent per calendar DAY at this office. Asia/Colombo is a
 * fixed +05:30 with no DST (see src/features/people/iso-day.ts), so the window
 * is arithmetic rather than a timezone library call — and resolving it in the
 * business timezone rather than the server's is what stops a 6am Colombo burst
 * from being charged to yesterday's budget.
 */
export function colomboDayWindow(dayIso: string): { from: Date; to: Date } {
  const from = new Date(`${dayIso}T00:00:00+05:30`)
  if (Number.isNaN(from.getTime())) throw new RangeError(`Not an ISO calendar day: ${dayIso}`)
  return { from, to: new Date(from.getTime() + 86_400_000) }
}
