import { db } from '@/db'
import { notifications } from '@/db/schema'

export type NewNotification = {
  userId: string
  actorId?: string | null
  type: 'mention' | 'meeting' | 'system'
  title: string
  body?: string | null
  link?: string | null
  meetingId?: string | null
}

// Bulk-insert notifications. Callers are responsible for not notifying the actor
// themselves; empty input is a no-op so call sites don't need to guard.
export async function createNotifications(rows: NewNotification[]): Promise<void> {
  const valid = rows.filter((r) => r.userId)
  if (valid.length === 0) return
  await db.insert(notifications).values(valid)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Mentions are stored as plain "@Name" text (see mention-textarea.tsx), so we
// match each known user's name as a whole @token. Longest names first prevents a
// short name ("@Sam") from matching inside a longer one ("@Samantha").
export function extractMentionedUserIds(
  text: string,
  users: { id: string; name: string }[],
): string[] {
  if (!text.includes('@')) return []
  const matched = new Set<string>()
  const byLength = [...users].sort((a, b) => b.name.length - a.name.length)
  for (const user of byLength) {
    const re = new RegExp(`(^|\\s)@${escapeRegExp(user.name)}(?=\\s|$|[.,!?;:])`, 'i')
    if (re.test(text)) matched.add(user.id)
  }
  return [...matched]
}
