/**
 * The worklog shape the Attendance Web App receives, and the pure parts of building it.
 *
 * Kept out of the route so it can be tested without a database — same split as serialize.ts.
 * Contract: docs/attendance-task-bridge.md ("GET /api/external/worklog").
 */

/** A `daily_worklogs` row: the day's self-score and note. */
export type WorklogHeaderInput = {
  day: string
  percent: number
  scoreSource: string
  note: string | null
}

/** A live `worklog_entries` row with its task and app names already joined. */
export type WorklogEntryInput = {
  id: string
  day: string
  minutes: number
  category: string
  billable: boolean
  note: string | null
  taskId: string | null
  taskTitle: string | null
  appName: string | null
  appSlug: string | null
}

export type ExternalWorklogDay = ReturnType<typeof assembleWorklogDays>[number]

/**
 * One object per day, newest first, from both tables.
 *
 * A day appears when EITHER table has it: logging time never requires the header row (see the
 * schema comment on worklog_entries), and a day can be scored with no time against it. `percent`
 * and `scoreSource` are null when there is no header — never invented. `scoreSource` travels with
 * the percent so a derived ('from_hours') score can be labelled as one, as every LogPup surface
 * does.
 *
 * `day` stays the plain YYYY-MM-DD string it is: an Asia/Colombo calendar day, not an instant.
 */
export function assembleWorklogDays(headers: WorklogHeaderInput[], entries: WorklogEntryInput[]) {
  const byDay = new Map<string, { header: WorklogHeaderInput | null; entries: WorklogEntryInput[] }>()
  for (const h of headers) byDay.set(h.day, { header: h, entries: [] })
  for (const e of entries) {
    const slot = byDay.get(e.day) ?? { header: null, entries: [] }
    slot.entries.push(e)
    byDay.set(e.day, slot)
  }

  return [...byDay.entries()]
    // Plain string compare is correct for zero-padded ISO dates.
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, { header, entries: list }]) => ({
      day,
      percent: header?.percent ?? null,
      scoreSource: header?.scoreSource ?? null,
      note: header?.note ?? null,
      minutes: list.reduce((sum, e) => sum + e.minutes, 0),
      entries: list.map((e) => ({
        id: e.id,
        minutes: e.minutes,
        category: e.category,
        billable: e.billable,
        note: e.note,
        task: e.taskId && e.taskTitle ? { id: e.taskId, title: e.taskTitle } : null,
        app: e.appName ? { name: e.appName, slug: e.appSlug ?? '' } : null,
      })),
    }))
}

const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const MAX_RANGE_DAYS = 62

/** The shape AND a real calendar day: '2026-02-31' matches the pattern, and Postgres would refuse
 *  it with an error rather than an answer. A round trip through UTC catches the rollover. */
function isRealDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false
  const t = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === value
}

/**
 * `email`, `from`, `to` — both dates required and inclusive. Bounded to 62 days (two months) so a
 * single request can never turn into a scan of somebody's whole history.
 */
export function parseWorklogParams(
  params: URLSearchParams,
): { ok: true; email: string; from: string; to: string } | { ok: false; error: string } {
  const email = (params.get('email') ?? '').trim().toLowerCase()
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  if (!isRealDay(from) || !isRealDay(to)) {
    return { ok: false, error: 'from and to must be real YYYY-MM-DD dates' }
  }
  const range = checkRange(from, to)
  if (range) return { ok: false, error: range }
  return { ok: true, email, from, to }
}

/** null when `from`..`to` is a usable range (both already real days), else why not. */
function checkRange(from: string, to: string): string | null {
  if (from > to) return 'from must not be after to'
  // Date arithmetic on UTC midnights is exact for whole-day differences; no timezone enters it.
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  if (span + 1 > MAX_RANGE_DAYS) return `range must be at most ${MAX_RANGE_DAYS} days`
  return null
}

const MAX_BATCH_EMAILS = 500

/**
 * The batch endpoint's JSON body: `{ emails: string[], from, to }`. Emails are normalised and
 * de-duplicated in first-seen order; a non-string or blank entry is dropped rather than failing
 * everyone else's answer. Same date rules as the single-person endpoint. At most 500 people —
 * a whole company's team view — so one call can never become a workspace-wide dump by accident.
 */
export function parseWorklogBatchBody(
  body: unknown,
): { ok: true; emails: string[]; from: string; to: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be a JSON object' }
  const b = body as { emails?: unknown; from?: unknown; to?: unknown }
  if (!Array.isArray(b.emails)) return { ok: false, error: 'emails must be an array' }
  const emails = [
    ...new Set(
      b.emails
        .filter((e): e is string => typeof e === 'string')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
  if (emails.length === 0) return { ok: false, error: 'emails must not be empty' }
  if (emails.length > MAX_BATCH_EMAILS) return { ok: false, error: `at most ${MAX_BATCH_EMAILS} emails` }
  const from = typeof b.from === 'string' ? b.from : ''
  const to = typeof b.to === 'string' ? b.to : ''
  if (!isRealDay(from) || !isRealDay(to)) {
    return { ok: false, error: 'from and to must be real YYYY-MM-DD dates' }
  }
  const range = checkRange(from, to)
  if (range) return { ok: false, error: range }
  return { ok: true, emails, from, to }
}

/** Rows bucketed by `userId`, every requested user present (an empty list when they have none). */
export function groupByUser<T extends { userId: string }>(userIds: string[], rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>(userIds.map((id) => [id, []]))
  for (const r of rows) m.get(r.userId)?.push(r)
  return m
}
