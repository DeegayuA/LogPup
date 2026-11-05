/**
 * Module D vocabulary and pure rules: DM pairing, channel names, presence
 * statuses and their expiry, reactions. Pure so the server actions and the
 * client share one tested definition.
 */

export const CHANNEL_KINDS = ['public', 'private', 'group', 'dm', 'context'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]

/**
 * The one key a pair of people shares, whichever of them opens the DM.
 * Sorted so (a,b) and (b,a) collide on the unique index instead of making two.
 */
export function dmKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

export const CHANNEL_NAME_MAX = 40
export const MESSAGE_MAX = 8000
export const GROUP_MAX_MEMBERS = 20

/**
 * "Release Planning!" → "release-planning". Lowercase letters, digits and
 * single dashes, 2..40 chars; null when nothing usable is left.
 */
export function normalizeChannelName(raw: string): string | null {
  const name = raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CHANNEL_NAME_MAX)
    .replace(/-+$/g, '')
  return name.length >= 2 ? name : null
}

export const STATUSES = ['available', 'busy', 'meeting', 'focus', 'lunch', 'away', 'dnd'] as const
export type PresenceStatus = (typeof STATUSES)[number]

/** The PRD's list, in its order. */
export const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: 'Available',
  busy: 'Busy',
  meeting: 'In a meeting',
  focus: 'Focus mode',
  lunch: 'At lunch',
  away: 'Away',
  dnd: 'Do not disturb',
}

/** A small icon per status, so the dot's colour is never the only signal. */
export const STATUS_EMOJI: Record<PresenceStatus, string> = {
  available: '🟢',
  busy: '⛔',
  meeting: '📅',
  focus: '🎧',
  lunch: '🍽️',
  away: '🌙',
  dnd: '🔕',
}

export function parseStatus(raw: unknown): PresenceStatus | null {
  return typeof raw === 'string' && (STATUSES as readonly string[]).includes(raw) ? (raw as PresenceStatus) : null
}

/** "Clear after" choices offered in the status picker. */
export const STATUS_DURATIONS = [
  { key: 'never', label: "Don't clear", minutes: null },
  { key: '30m', label: '30 minutes', minutes: 30 },
  { key: '1h', label: '1 hour', minutes: 60 },
  { key: '4h', label: '4 hours', minutes: 240 },
  { key: 'today', label: 'Today', minutes: 'end-of-day' as const },
] as const
export type StatusDurationKey = (typeof STATUS_DURATIONS)[number]['key']

/**
 * When a status set now with this duration should expire. "Today" means the
 * end of the caller's day in Sri Lanka (UTC+5:30, no DST) — the business
 * timezone every other date in the app uses.
 */
export function statusExpiry(key: StatusDurationKey, now: Date): Date | null {
  const choice = STATUS_DURATIONS.find((d) => d.key === key)
  if (!choice || choice.minutes === null) return null
  if (choice.minutes === 'end-of-day') {
    const offsetMs = 330 * 60_000
    const local = new Date(now.getTime() + offsetMs)
    const endLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 23, 59, 59)
    return new Date(endLocal - offsetMs)
  }
  return new Date(now.getTime() + choice.minutes * 60_000)
}

/** The status as everyone else sees it: an expired one is no status at all. */
export function effectiveStatus(
  row: { status: PresenceStatus; note: string | null; expiresAt: Date | null } | null | undefined,
  now: Date,
): { status: PresenceStatus; note: string | null; expiresAt: Date | null } | null {
  if (!row) return null
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return null
  return row
}

/** The quick reactions offered on every message. Anything else is refused. */
export const REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '✅', '🙏', '🚀'] as const
export type Reaction = (typeof REACTIONS)[number]

export function isReaction(raw: unknown): raw is Reaction {
  return typeof raw === 'string' && (REACTIONS as readonly string[]).includes(raw)
}

/** How often an open conversation asks for new messages (no live socket on this host). */
export const CHAT_POLL_MS = 4000
