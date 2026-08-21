/**
 * Planned maintenance, as pure arithmetic.
 *
 * NOTHING HERE TOUCHES THE DATABASE, THE SESSION, OR THE DOM. Everything the
 * feature decides — is a window on, has it started, what does the countdown
 * say, what does the auto-written message read — is a function of a row and a
 * millisecond, so all of it is unit-testable and every surface (server render,
 * client tick, the notification body a cron-less lifecycle writes) reaches the
 * same answer from the same inputs.
 *
 * THE PARSER FAILS OPEN, DELIBERATELY. A maintenance row is the one row in the
 * app that can lock every person out of it, so a malformed one must mean "no
 * maintenance" and never "maintenance forever". Every branch in
 * `parseMaintenanceWindow` that cannot prove the window is well-formed returns
 * null, and null means off. A bad deploy, a half-written row, a column that
 * came back as the wrong type: all of them are indistinguishable from nobody
 * having armed anything, which is the only safe reading.
 *
 * TIMES ARE WALL-CLOCK. The admin picks the window in a datetime-local input,
 * which is unavoidably the browser's own zone, so that is the zone the whole
 * feature speaks. Server-side formatting (notification bodies) passes
 * Asia/Colombo explicitly — see LK_TIMEZONE in src/lib/lk-holidays.ts, the one
 * zone this workspace works in — because a server formatting in UTC would
 * announce a 20:00 window as 14:30.
 */

/** The row is a singleton. One window at a time, by design. */
export const MAINTENANCE_SINGLETON_ID = 'current'

export const MAINTENANCE_MODES = ['readonly', 'block', 'lockdown'] as const
export type MaintenanceMode = (typeof MAINTENANCE_MODES)[number]

export const MAINTENANCE_KINDS = ['maintenance', 'upgrade', 'emergency'] as const
export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number]

/**
 * Derived from the wall clock, never stored. A stored phase would be a second
 * source of truth that goes stale the moment nobody writes to it, which for a
 * window whose whole job is to end on time is the one failure that matters.
 */
export type MaintenancePhase = 'off' | 'scheduled' | 'active' | 'ended'

export type MaintenanceWindow = {
  enabled: boolean
  startAtMs: number
  endAtMs: number
  message: string
  mode: MaintenanceMode
  kind: MaintenanceKind
  createdBy: string
  createdByName: string
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Milliseconds, from a number or from a numeric string.
 *
 * The string arm is not laxness: `start_at_ms` is a Postgres bigint, and a
 * bigint over an HTTP driver comes back as a string often enough that
 * rejecting one would mean the feature silently never activates — a failure
 * that looks exactly like "nobody armed it" and would be found in production.
 * A non-numeric string still fails, so garbage still cannot arm a window.
 */
function asMs(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'bigint') return Number(value)
  return null
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function has<T extends readonly string[]>(list: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

/**
 * A stored row, validated into something the UI may act on — or null.
 *
 * Null is the ONLY failure mode, and it means off. See the module docblock:
 * every rejection below is a case where the row cannot be trusted, and an
 * untrusted maintenance row must never be the thing that keeps people out.
 */
export function parseMaintenanceWindow(raw: unknown): MaintenanceWindow | null {
  if (raw === null || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>

  const startAtMs = asMs(row.startAtMs)
  const endAtMs = asMs(row.endAtMs)
  // Missing numbers, and a window that ends before it begins, are the two
  // shapes the spec names as off. A zero-length window is off too: an
  // end-exclusive phase test would make `start === end` an interval no
  // millisecond falls inside, so treating it as armed would show a scheduled
  // banner for a window that can never become active.
  if (startAtMs === null || endAtMs === null) return null
  if (endAtMs <= startAtMs) return null

  // An unrecognised mode or kind is a row written by something that does not
  // agree with this build about what those words mean. Guessing a default
  // would be guessing how hard to lock the door.
  if (!has(MAINTENANCE_MODES, row.mode)) return null
  if (!has(MAINTENANCE_KINDS, row.kind)) return null

  return {
    // Anything other than a literal true is off. `enabled` is the switch; a
    // truthy string is somebody's bug, not somebody's intent.
    enabled: row.enabled === true,
    startAtMs,
    endAtMs,
    message: asText(row.message),
    mode: row.mode,
    kind: row.kind,
    createdBy: asText(row.createdBy),
    createdByName: asText(row.createdByName, 'an admin'),
  }
}

/**
 * START INCLUSIVE, END EXCLUSIVE.
 *
 * At exactly startAtMs the window is active — a window that began "at 20:00"
 * and is not yet on at 20:00:00.000 is a window whose announced time was a
 * lie. At exactly endAtMs it is over, for the mirror reason: the announced
 * "back at 06:00" has to be true at 06:00:00.000, not one tick later.
 */
export function maintenancePhase(
  window: MaintenanceWindow | null,
  nowMs: number,
): MaintenancePhase {
  if (!window || !window.enabled) return 'off'
  if (!Number.isFinite(nowMs)) return 'off'
  if (nowMs < window.startAtMs) return 'scheduled'
  if (nowMs < window.endAtMs) return 'active'
  return 'ended'
}

/** The moment the phase would next change, or null when nothing is pending. */
export function nextPhaseChangeAtMs(
  window: MaintenanceWindow | null,
  nowMs: number,
): number | null {
  const phase = maintenancePhase(window, nowMs)
  if (!window) return null
  if (phase === 'scheduled') return window.startAtMs
  if (phase === 'active') return window.endAtMs
  return null
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/**
 * A countdown a person can read at a glance.
 *
 * Clamps at zero rather than going negative: the instant a countdown would
 * turn negative the phase has already changed, and a screen showing "-00:03"
 * is a screen that has stopped agreeing with the thing beside it.
 */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / SECOND)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`
  return `${pad2(minutes)}:${pad2(seconds)}`
}

/** "10h", "1h 30m", "45m" — for the summary line and the auto-written message. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m'
  const totalMinutes = Math.max(1, Math.round(ms / MINUTE))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/**
 * The <input type="datetime-local"> value for a moment, in the BROWSER's zone.
 *
 * Built from the Date's local getters rather than a sliced ISO string, because
 * toISOString() is UTC: in Colombo that renders a 20:00 window into the input
 * as 14:30, and the admin then "corrects" it into a window five and a half
 * hours off the one they meant.
 */
export function toDatetimeLocal(ms: number): string {
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return ''
  const year = String(date.getFullYear()).padStart(4, '0')
  return `${year}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** The inverse. Null for anything the input could not have produced. */
export function fromDatetimeLocal(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
    0,
  )
  const ms = date.getTime()
  if (Number.isNaN(ms)) return null
  // Reject dates the calendar rolled over (2026-02-31 becomes 3 March). The
  // input cannot emit one, but a hand-typed value can.
  if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null
  return ms
}

function atLocalTime(ms: number, hour: number, minute: number): number {
  const date = new Date(ms)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

export type WindowRange = { startAtMs: number; endAtMs: number }

/**
 * What the control popup opens on: tonight, after hours.
 *
 * Tomorrow's 20:00 once today's has passed, so opening the popup at 21:00
 * never proposes a window that is already half over.
 */
export function defaultWindow(nowMs: number): WindowRange {
  let startAtMs = atLocalTime(nowMs, 20, 0)
  if (startAtMs <= nowMs) startAtMs = atLocalTime(nowMs + DAY, 20, 0)
  return { startAtMs, endAtMs: atLocalTime(startAtMs + DAY, 6, 0) }
}

/** The next 06:00 strictly after `ms`. */
function nextSixAm(ms: number): number {
  const today = atLocalTime(ms, 6, 0)
  return today > ms ? today : atLocalTime(ms + DAY, 6, 0)
}

export type MaintenancePreset = {
  id: string
  label: string
  resolve: (nowMs: number) => WindowRange
}

/** The four windows an admin actually arms, one click each. */
export const MAINTENANCE_PRESETS: readonly MaintenancePreset[] = [
  { id: 'tonight', label: 'Tonight 20:00 → 06:00', resolve: defaultWindow },
  { id: 'now-six', label: 'Now → 06:00', resolve: (now) => ({ startAtMs: now, endAtMs: nextSixAm(now) }) },
  { id: 'now-1h', label: 'Now +1h', resolve: (now) => ({ startAtMs: now, endAtMs: now + HOUR }) },
  { id: 'now-2h', label: 'Now +2h', resolve: (now) => ({ startAtMs: now, endAtMs: now + 2 * HOUR }) },
]

export type ExtendStep = { label: string; ms: number }

/** Push the end back without retyping it — the "this is taking longer" chips. */
export const EXTEND_STEPS: readonly ExtendStep[] = [
  { label: '+30m', ms: 30 * MINUTE },
  { label: '+1h', ms: HOUR },
  { label: '+2h', ms: 2 * HOUR },
  { label: '+12h', ms: 12 * HOUR },
]

/**
 * Formatting helpers take an explicit zone so a server and a browser can
 * produce the same sentence. `undefined` means the runtime's own zone, which
 * is what every client surface wants.
 */
function clockFormatter(timeZone?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  })
}

function dayFormatter(timeZone?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone })
}

function isoDay(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date(ms))
}

/** "20:00" */
export function formatClock(ms: number, timeZone?: string): string {
  return clockFormatter(timeZone).format(new Date(ms))
}

/** "21 Aug, 20:00" */
export function formatMoment(ms: number, timeZone?: string): string {
  return `${dayFormatter(timeZone).format(new Date(ms))}, ${formatClock(ms, timeZone)}`
}

/**
 * "21 Aug, 20:00–23:00" within a day, "21 Aug, 20:00 → 22 Aug, 06:00" across
 * one. The overnight case is the common one, and repeating the date on both
 * ends of a same-day window is the kind of noise that makes people stop
 * reading the banner.
 */
export function formatWindowRange(startAtMs: number, endAtMs: number, timeZone?: string): string {
  const sameDay = isoDay(startAtMs, timeZone) === isoDay(endAtMs, timeZone)
  return sameDay
    ? `${formatMoment(startAtMs, timeZone)}–${formatClock(endAtMs, timeZone)}`
    : `${formatMoment(startAtMs, timeZone)} → ${formatMoment(endAtMs, timeZone)}`
}

/** The live line under the pickers: the window, and how long it lasts. */
export function formatWindowSummary(
  startAtMs: number,
  endAtMs: number,
  timeZone?: string,
): string {
  if (endAtMs <= startAtMs) return 'End time must be after the start time.'
  return `${formatWindowRange(startAtMs, endAtMs, timeZone)} · ${formatDuration(endAtMs - startAtMs)}`
}

export const KIND_HEADINGS: Record<MaintenanceKind, string> = {
  maintenance: 'Scheduled maintenance',
  upgrade: 'LogPup is upgrading',
  emergency: 'Emergency maintenance',
}

export const KIND_LABELS: Record<MaintenanceKind, string> = {
  maintenance: 'Maintenance',
  upgrade: 'Upgrade',
  emergency: 'Emergency',
}

export const MODE_LABELS: Record<MaintenanceMode, string> = {
  readonly: 'Read-only',
  block: 'Admins only',
  lockdown: 'Locked down',
}

export const MODE_SUMMARIES: Record<MaintenanceMode, string> = {
  readonly: 'People may choose to keep looking. Nothing can be changed.',
  block: 'Only admins get in. Everyone else waits on this screen.',
  lockdown: 'Nobody gets past this screen, and it cannot be dismissed.',
}

/**
 * The message the admin gets for free.
 *
 * Regenerated from kind and window on every change until the admin types over
 * it — the popup owns that flag. Each kind says a genuinely different thing:
 * planned work asks people to save, an upgrade explains the absence, and an
 * emergency apologises for the notice it could not give.
 */
export function autoMessage(
  kind: MaintenanceKind,
  startAtMs: number,
  endAtMs: number,
  timeZone?: string,
): string {
  const range = formatWindowRange(startAtMs, endAtMs, timeZone)
  const duration = formatDuration(endAtMs - startAtMs)
  switch (kind) {
    case 'maintenance':
      return `LogPup is down for scheduled maintenance, ${range} (${duration}). Please save anything you are part-way through before it starts.`
    case 'upgrade':
      return `We are putting a new version of LogPup out, ${range} (${duration}). LogPup will be unavailable while it goes out, and nothing you have logged is affected.`
    case 'emergency':
      return `LogPup is offline for emergency work, ${range} (${duration}). Sorry for the short notice — we will be back as soon as the work is done.`
  }
}

/** The line the "we're back" announcement carries. */
export function backOnlineMessage(kind: MaintenanceKind): string {
  return kind === 'emergency'
    ? 'LogPup is back online. Thanks for your patience — the emergency work is done.'
    : 'LogPup is back online. Maintenance is finished and everything is writable again.'
}

/** The title the "it has started" announcement carries. */
export function startedTitle(kind: MaintenanceKind): string {
  return kind === 'upgrade' ? 'LogPup is upgrading now' : `${KIND_HEADINGS[kind]} has started`
}

/**
 * Under ten minutes the banner turns red.
 *
 * Amber for hours away, red for "stop typing" — a single colour for both
 * teaches people to ignore the one that matters.
 */
export const URGENT_THRESHOLD_MS = 10 * MINUTE

export function isUrgent(msRemaining: number): boolean {
  return msRemaining <= URGENT_THRESHOLD_MS
}
