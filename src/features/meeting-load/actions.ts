'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { meetingLoadDecisions } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { can, type UserRole } from '@/features/auth/capabilities'
import { gatherLoadFacts } from '@/features/meeting-load/gather'
import type { SuggestionKind } from '@/features/meeting-load/suggest'

/**
 * Accept, dismiss, reopen — the only writes sub-project B performs.
 *
 * ACCEPT IS ADVISORY, and the absence of a one-click apply is the design rather
 * than a gap. Accepting records intent and hands back a deep link into a flow
 * the organizer already owns (the occurrence's own page, the invite editor).
 * Nothing here mutates `meetings`, `endsAt`, or `meeting_attendees`. A rule
 * that could rewrite somebody's calendar on the strength of a median would be a
 * rule nobody could safely leave switched on.
 *
 * Every metric surface is read-only; these three functions are the whole write
 * surface, and they touch exactly one table.
 */

const KINDS = [
  'cancel_review', 'shorten', 'share_slot', 'record_or_review', 'trim_invite',
] as const

const decisionInput = z.object({
  kind: z.enum(KINDS),
  targetKey: z.string().min(1).max(512),
})

/**
 * Who may decide.
 *
 * Admin, or the organizer of the series in question. For `share_slot`, whose
 * target key encodes a SORTED PAIR, EITHER organizer may act: the suggestion is
 * a question about both series at once, and requiring the same person to run
 * both would make the rule undecidable exactly when it is most useful — two
 * different people holding two meetings that could be one.
 */
async function mayDecide(
  user: { id: string; role?: string | null },
  targetKey: string,
  now: Date,
): Promise<boolean> {
  const actor = {
    id: user.id,
    role: (user.role ?? 'member') as UserRole,
    scopeAppIds: new Set<string>() as ReadonlySet<string>,
  }
  if (can(actor, 'meeting.intel.view')) return true

  const facts = await gatherLoadFacts(now)
  const organizers = new Set(
    facts
      .redactedSeriesMetrics(now)
      .filter((series) => targetKey.includes(series.groupKey))
      .map((series) => series.organizerId),
  )
  return organizers.has(user.id)
}

/** Postgres unique violation, walked through `.cause` the way the people
 *  actions already do it — the driver nests the real error. */
function isUniqueViolation(error: unknown): boolean {
  let cursor: unknown = error
  for (let depth = 0; depth < 5 && cursor; depth += 1) {
    if (typeof cursor === 'object' && cursor !== null && 'code' in cursor) {
      if ((cursor as { code?: string }).code === '23505') return true
    }
    cursor = (cursor as { cause?: unknown }).cause
  }
  return false
}

function revalidateAll() {
  revalidatePath('/')
  revalidatePath('/meetings')
  revalidatePath('/meetings/load')
  revalidatePath('/admin')
}

async function decide(
  kind: SuggestionKind,
  targetKey: string,
  evidence: Record<string, unknown>,
  status: 'accepted' | 'dismissed',
): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const parsed = decisionInput.safeParse({ kind, targetKey })
  if (!parsed.success) return err('Unknown suggestion')
  // The key has to name its own rule. A key that did not would let one rule's
  // dismissal silence another's suggestion.
  if (!targetKey.startsWith(`${kind}:`)) return err('Unknown suggestion')

  if (!(await mayDecide(session.user, targetKey, new Date()))) return err('Not available')

  try {
    await db.insert(meetingLoadDecisions).values({
      kind,
      targetKey,
      // Stated explicitly, never defaulted: the column has no default, because
      // 'open' means "no row" and a default would invent a third state.
      status,
      // The snapshot verbatim, so what somebody decided against stays
      // recoverable even after the live numbers have moved.
      evidence,
      decidedBy: session.user.id,
    })
  } catch (error) {
    if (isUniqueViolation(error)) return err('Already decided')
    throw error
  }

  revalidateAll()
  return ok(undefined)
}

/**
 * Record that somebody intends to act, and point them at where to do it.
 *
 * The deep link is the whole payload. There is no apply.
 */
export async function acceptLoadSuggestion(
  kind: SuggestionKind,
  targetKey: string,
  evidence: Record<string, unknown>,
): Promise<ActionResult<{ deepLink: string }>> {
  const result = await decide(kind, targetKey, evidence, 'accepted')
  if (!result.ok) return err(result.error)
  return ok({ deepLink: deepLinkFor(kind) })
}

/** Where the organizer goes to actually make the change, through code they
 *  already own. Never a write from here. */
function deepLinkFor(kind: SuggestionKind): string {
  // trim_invite is the one that lands somewhere different: making somebody
  // optional is an invite-list edit, not a change to the meeting itself.
  if (kind === 'trim_invite') return '/meetings?edit=invites'
  return '/meetings'
}

export async function dismissLoadSuggestion(
  kind: SuggestionKind,
  targetKey: string,
  evidence: Record<string, unknown>,
): Promise<ActionResult<void>> {
  return decide(kind, targetKey, evidence, 'dismissed')
}

/**
 * The escape hatch, and the only path back from a dismissal.
 *
 * ADMIN ONLY, and a genuine hard delete: the row IS the suppression, so marking
 * it deleted and leaving it in place would suppress the suggestion forever,
 * which is the opposite of reopening it. Nothing is lost — open suggestions are
 * never stored, and the engine re-derives this one from live rows the moment
 * the row is gone.
 */
export async function reopenLoadDecision(id: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const actor = {
    id: session.user.id,
    role: (session.user.role ?? 'member') as UserRole,
    scopeAppIds: new Set<string>() as ReadonlySet<string>,
  }
  // Deliberately not `mayDecide`: overruling somebody else's dismissal is a
  // different power from making one, and the engine puts Reopen on /admin.
  if (!can(actor, 'meeting.intel.view')) return err('Not available')

  await db.delete(meetingLoadDecisions).where(and(eq(meetingLoadDecisions.id, id)))

  revalidateAll()
  return ok(undefined)
}
