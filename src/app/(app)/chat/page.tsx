import { redirect } from 'next/navigation'
import { loadActor } from '@/features/auth/actor'
import { loadChannelAccess } from '@/features/chat/access'
import { isUuid } from '@/features/sprints/attachments'

/**
 * PRD Module D, user's rule: project talk stays INSIDE the project. There is
 * no standalone chat page any more — every conversation lives on its
 * project's Chat tab. This route survives only as a forwarder, because
 * mention notifications already in people's bells and the Discuss buttons
 * link to /chat?c=<channel>&t=<message>.
 *
 * A channel the viewer cannot read, or one with no project (a DM or group
 * made before this rule), forwards to /apps — the same answer as a missing
 * one, so the redirect never confirms a conversation exists.
 */
export default async function ChatPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [actor, search] = await Promise.all([loadActor(), props.searchParams])
  if (!actor) redirect('/sign-in')
  const c = typeof search.c === 'string' ? search.c : null
  const t = typeof search.t === 'string' ? search.t : null
  const ch = c && isUuid(c) ? await loadChannelAccess(actor, c) : null
  if (!ch || !ch.perms.read || !ch.app) redirect('/apps')
  const params = new URLSearchParams({ tab: 'chat', c: ch.id })
  if (t && isUuid(t)) params.set('t', t)
  redirect(`/apps/${ch.app.slug}?${params.toString()}`)
}
