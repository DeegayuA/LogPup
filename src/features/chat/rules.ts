import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import type { ChannelKind } from './chat'

/**
 * Who may do what in ONE conversation — the whole Module D access matrix as a
 * pure function, so every server path (queries, actions, the attachment
 * download) asks the same question and the answer is unit tested.
 *
 * The caller supplies the facts it read from the database and the
 * capability matrix: membership, and app.view / task.comment / sprint.manage
 * on the conversation's project (false for DMs and groups, which have none).
 * Nothing here trusts the client.
 *
 * Why private channels need app.view AS WELL AS membership: a person moved
 * off the project keeps their channel_members row (nobody sweeps it), and the
 * channel is project work. Losing the project must lose the channel.
 */

export type ChannelFacts = {
  kind: ChannelKind
  archived: boolean
  isMember: boolean
  isOwner: boolean
  /** app.view on the conversation's project. */
  canView: boolean
  /** task.comment on the conversation's project. */
  canComment: boolean
  /** sprint.manage on the conversation's project. */
  canManage: boolean
}

export type ChannelPermissions = {
  read: boolean
  /** Post, reply, react. Public/context channels join on first write. */
  write: boolean
  /** Add people. */
  addMembers: boolean
  /** Delete other people's messages. */
  moderate: boolean
}

const NONE: ChannelPermissions = { read: false, write: false, addMembers: false, moderate: false }

export function channelPermissions(f: ChannelFacts): ChannelPermissions {
  let p: ChannelPermissions
  switch (f.kind) {
    case 'public':
    case 'context':
      p = {
        read: f.canView,
        write: f.canView && f.canComment,
        addMembers: false, // anyone who can read joins by posting
        moderate: f.canView && f.canManage,
      }
      break
    case 'private': {
      const read = f.isMember && f.canView
      p = {
        read,
        write: read && f.canComment,
        addMembers: f.canView && ((f.isMember && f.isOwner) || f.canManage),
        moderate: read && f.canManage,
      }
      break
    }
    case 'group':
      p = { read: f.isMember, write: f.isMember, addMembers: f.isMember, moderate: false }
      break
    case 'dm':
      // Exactly two people, forever: dm_key is the pair.
      p = { read: f.isMember, write: f.isMember, addMembers: false, moderate: false }
      break
    default:
      return NONE
  }
  if (f.archived) return { ...p, write: false, addMembers: false }
  return p
}

/** "Mark read up to here" never moves backwards (two tabs, one slow). */
export function laterOf(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b
}

/**
 * The polling window. The client sends the server time of its last poll; the
 * next window starts a few seconds earlier, because created_at is the
 * DATABASE clock and the cursor is the app server's — a row stamped a moment
 * "before" the cursor by a skewed clock would otherwise never be seen. The
 * client merges by id, so the overlap costs a duplicate, never a gap.
 */
export const POLL_OVERLAP_MS = 5000

export function pollSince(afterIso: string, now: Date): Date | null {
  const after = new Date(afterIso)
  if (Number.isNaN(after.getTime())) return null
  // A cursor from the future (or a forged one far in the past) is clamped:
  // the past to one hour, so a sleeping tab cannot ask for the whole history.
  const floor = now.getTime() - 60 * 60_000
  const t = Math.min(Math.max(after.getTime(), floor), now.getTime())
  return new Date(t - POLL_OVERLAP_MS)
}

/** A group's display name when nobody named it: "Ann, Bo and 3 others". */
export function groupTitle(names: readonly string[], max = 3): string {
  if (names.length === 0) return 'Group'
  if (names.length <= max) {
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }
  const rest = names.length - max
  return `${names.slice(0, max).join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`
}

/** Markdown for a shared file, as it appears in the message body. */
export function fileMessageBody(attachmentId: string, name: string, isImage: boolean): string {
  // Brackets and parens would break the link; the name is display-only anyway.
  const label = name.replace(/[[\]()\\]/g, '')
  const href = `/api/attachments/${attachmentId}`
  return isImage ? `![${label}](${href})` : `📎 [${label}](${href})`
}

/**
 * Set or drop query params on a base href that may already carry some
 * ("/apps/x?tab=chat"). Null removes a param.
 */
export function withParams(base: string, params: Record<string, string | null>): string {
  const [path, query = ''] = base.split('?')
  const search = new URLSearchParams(query)
  for (const [k, v] of Object.entries(params)) {
    if (v === null) search.delete(k)
    else search.set(k, v)
  }
  const s = search.toString()
  return s ? `${path}?${s}` : path
}

/**
 * A poll the server REFUSES (not a network error — those throw and retry) means
 * the viewer lost the conversation: removed from the project, the channel or
 * work item trashed. One refusal can be a deploy blip; this many in a row is
 * an answer, and polling a door that stays shut every 4s is pure load.
 */
export const POLL_REJECT_LIMIT = 3

/** The run of consecutive refusals after one more poll. Success resets it. */
export function nextRejectCount(previous: number, ok: boolean): number {
  return ok ? 0 : previous + 1
}

export function pollGaveUp(rejects: number): boolean {
  return rejects >= POLL_REJECT_LIMIT
}

/**
 * Files one person may share into one conversation per rolling hour. A chat
 * upload is a blob write plus a message everyone in the room sees, so the cap
 * is per conversation as well as per person: a flood in one room is the harm.
 */
export const UPLOAD_LIMIT_PER_HOUR = 20
export const UPLOAD_WINDOW_MS = 60 * 60_000

/** Null when one more upload is allowed, else the message to show. */
export function uploadLimitError(recentUploads: number): string | null {
  if (recentUploads < UPLOAD_LIMIT_PER_HOUR) return null
  return `You can share up to ${UPLOAD_LIMIT_PER_HOUR} files an hour in one conversation — try again later`
}

/** The sidebar Chat badge caps the digit; the label always says the real number. */
export const UNREAD_BADGE_MAX = 99

export function unreadBadgeText(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '0'
  return total > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : String(Math.floor(total))
}

export function unreadBadgeLabel(total: number): string {
  const n = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  if (n === 0) return 'No unread messages'
  return `${n} unread ${n === 1 ? 'message' : 'messages'}`
}

/**
 * Who a mention in this body should ping. The author never; on an edit, nobody
 * the previous body already named (fixing a typo re-pings nobody) and nobody
 * already holding a mention notification for this message — so taking @X out
 * and putting it back across edits pings X once, not once per edit.
 */
export function mentionTargets(input: {
  mentioned: readonly string[]
  actorId: string
  previouslyMentioned?: readonly string[]
  alreadyNotified?: readonly string[]
}): string[] {
  const skip = new Set([input.actorId, ...(input.previouslyMentioned ?? []), ...(input.alreadyNotified ?? [])])
  return [...new Set(input.mentioned)].filter((id) => !skip.has(id))
}

// --- presentation: previews, times, day separators, message runs -----------
//
// Pure and in Asia/Colombo on purpose: the server render and the browser must
// print the same words (a UTC server and a +5:30 browser would otherwise
// disagree about "Today" and fail hydration), and every other date in the app
// is a Sri Lankan date.

/** Longest preview a conversation row shows; the query clips the body well before this runs. */
export const SNIPPET_MAX = 80

const FILE_ONLY = /^\s*(?:📎\s*)?!?\[([^\]]*)\]\(\/api\/attachments\/[^)\s]+\)\s*$/u

/**
 * One line of plain text from a message body for the conversation list:
 * Markdown marks, link targets and code fences go; the words stay. A message
 * that is only a shared file (fileMessageBody) reads "📎 name". Mentions are
 * plain "@Name" text in the source (MentionTextarea writes them that way), so
 * they survive as written; a link-shaped "@[Name](…)" keeps just "@Name".
 */
export function messageSnippet(body: string, max = SNIPPET_MAX): string {
  const file = FILE_ONLY.exec(body)
  if (file) return clip(`📎 ${file[1].trim() || 'file'}`, max)
  const text = body
    .replace(/```[^\n]*\n?([\s\S]*?)(?:```|$)/g, ' $1 ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, ' ')
    .replace(/^\s{0,3}(?:#{1,6}\s+|(?:>\s?)+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](?=\S)([^*_\n]*?\S)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clip(text, max)
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** "You: hi", "Ann Perera: hi", or "Message deleted" — never a deleted body. */
export function previewLine(p: { authorName: string; mine: boolean; snippet: string; deleted: boolean }): string {
  if (p.deleted) return 'Message deleted'
  return `${p.mine ? 'You' : p.authorName}: ${p.snippet}`
}

const DAY_MS = 86_400_000
const formatters = new Map<string, Intl.DateTimeFormat>()

function lkParts(date: Date, options: Intl.DateTimeFormatOptions): Partial<Record<Intl.DateTimeFormatPartTypes, string>> {
  const key = JSON.stringify(options)
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: LK_TIMEZONE })
    formatters.set(key, f)
  }
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of f.formatToParts(date)) out[part.type] = part.value
  return out
}

const asDate = (d: Date | string) => (d instanceof Date ? d : new Date(d))

/** The Sri Lankan calendar day a moment falls on, "yyyy-mm-dd". */
export function lkDayKey(d: Date | string): string {
  return toIsoDateInTimeZone(asDate(d))
}

/** "3 Nov", with the year when it is not this year's. */
function shortDate(date: Date, now: Date): string {
  const p = lkParts(date, { day: 'numeric', month: 'short', year: 'numeric' })
  const sameYear = p.year === lkDayKey(now).slice(0, 4)
  return sameYear ? `${p.day} ${p.month}` : `${p.day} ${p.month} ${p.year}`
}

/** A conversation row's time: "now", "4m", "1h", "Yesterday", "3 Nov". */
export function relativeTime(at: Date | string, now: Date): string {
  const date = asDate(at)
  const diff = now.getTime() - date.getTime()
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  const day = lkDayKey(date)
  if (day === lkDayKey(now)) return `${Math.floor(diff / 3_600_000)}h`
  if (day === lkDayKey(new Date(now.getTime() - DAY_MS))) return 'Yesterday'
  return shortDate(date, now)
}

/** A date separator: "Today", "Yesterday", "Mon, 3 Nov". */
export function dayLabel(at: Date | string, now: Date): string {
  const date = asDate(at)
  const day = lkDayKey(date)
  if (day === lkDayKey(now)) return 'Today'
  if (day === lkDayKey(new Date(now.getTime() - DAY_MS))) return 'Yesterday'
  return `${lkParts(date, { weekday: 'short' }).weekday}, ${shortDate(date, now)}`
}

/**
 * "4:05 PM". Built from parts because ICU versions disagree on the space
 * before AM/PM (a narrow no-break space in newer ones) and on its case, and
 * the server's Node and the browser must print the same string.
 */
export function clockTime(at: Date | string): string {
  const p = lkParts(asDate(at), { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toUpperCase()}`.trim()
}

/** Same author within this long reads as one run: one avatar, one name. */
export const RUN_GAP_MS = 5 * 60_000

/**
 * Where each message sits in the list: whether a new Sri Lankan day starts at
 * it (a date separator goes above) and whether it starts a run (it shows the
 * avatar and name). A run breaks on a new day, a new author, or a gap over
 * RUN_GAP_MS from the message before.
 */
export function messageRuns(
  list: readonly { authorId: string; createdAt: Date | string }[],
): { newDay: boolean; startsRun: boolean }[] {
  return list.map((m, i) => {
    const prev = i > 0 ? list[i - 1] : null
    const newDay = prev === null || lkDayKey(prev.createdAt) !== lkDayKey(m.createdAt)
    const startsRun =
      prev === null ||
      newDay ||
      prev.authorId !== m.authorId ||
      asDate(m.createdAt).getTime() - asDate(prev.createdAt).getTime() > RUN_GAP_MS
    return { newDay, startsRun }
  })
}
