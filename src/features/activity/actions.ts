'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import {
  ACTIVITY_PAGE_SIZE,
  decodeActivityCursor,
  encodeActivityCursor,
} from '@/features/activity/filters'
import { listActivity } from '@/features/activity/queries'
import { activityRowSearchText, rankActivityMatches } from '@/features/activity/search'
import {
  ACTIVITY_ENTITY_TYPES,
  type ActivityFilters,
  type ActivityRow,
} from '@/features/activity/types'

/**
 * "Load older" as an APPEND, not a navigation. The link version replaced the
 * whole page per cursor: walking back N pages cost N clicks, and each one
 * threw away the rows already read plus the scroll position among them. This
 * action returns the next keyset page for the client pager
 * (activity-trail-pager.tsx) to append; the URL cursor stays for deep-linking
 * via history.replaceState on the client, so a shared or reloaded URL still
 * resumes from the same spot.
 *
 * Validation mirrors the page's own searchParams contract: every invalid
 * value degrades to "not filtered" rather than to an error — the client can
 * only send state the page already validated, so a mismatch here is a bug or
 * a forged call, and both degrade safely. The session gate matches the page:
 * signed in is the only requirement, because the trail is the whole team's
 * shared memory.
 */
const loadOlderInput = z.object({
  person: z.uuid().optional().catch(undefined),
  type: z.enum(ACTIVITY_ENTITY_TYPES).optional().catch(undefined),
  app: z.uuid().optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  q: z.string().trim().min(1).optional().catch(undefined),
  before: z.string().min(1),
})

/**
 * Deliberately WIDER than the schema (plain strings): the caller holds URL
 * state, and the schema's job is to degrade whatever arrives — a stale enum
 * value must fall to "not filtered" at runtime, not fail the build for the
 * client that forwarded it.
 */
export type LoadOlderInput = {
  person?: string
  type?: string
  app?: string
  from?: string
  to?: string
  q?: string
  before: string
}

export type LoadOlderResult = {
  rows: ActivityRow[]
  hasMore: boolean
  /** Keyset cursor for the page after this one, off the PRIMARY row order. */
  nextCursor: string | null
}

// Colombo is UTC+05:30 year-round (no DST — see iso-day.ts, which leans on
// the same fact), so a calendar-day bound converts to an instant with a
// fixed offset — the same conversion the /activity page itself performs.
function colomboDayStart(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00+05:30`)
}
function colomboDayEnd(isoDay: string): Date {
  return new Date(`${isoDay}T23:59:59.999+05:30`)
}

export async function loadOlderActivity(
  input: LoadOlderInput,
): Promise<ActionResult<LoadOlderResult>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  const parsed = loadOlderInput.safeParse(input)
  if (!parsed.success) return err('That page reference is not valid — reload and try again.')

  const cursor = decodeActivityCursor(parsed.data.before)
  if (!cursor) return err('That page reference is not valid — reload and try again.')

  const filters: ActivityFilters = {
    actorId: parsed.data.person,
    entityType: parsed.data.type,
    appId: parsed.data.app,
    from: parsed.data.from ? colomboDayStart(parsed.data.from) : undefined,
    to: parsed.data.to ? colomboDayEnd(parsed.data.to) : undefined,
    q: parsed.data.q,
  }

  const { rows, hasMore } = await listActivity({
    limit: ACTIVITY_PAGE_SIZE,
    filters,
    cursor,
  })

  // Mirror the page's Layer-2 treatment for a searched trail: within each
  // fetched page, best match first. Deliberately NOT re-ranked across the
  // pages already on screen — reshuffling rows the reader has read is worse
  // than a per-page order. No fuzzy fallback here: the first page already
  // decided whether this is an exact-match trail, and `hasMore` was false for
  // a fallback view, so this action is never reached in that state.
  const displayRows =
    parsed.data.q && rows.length > 0
      ? rankActivityMatches(rows, parsed.data.q, activityRowSearchText)
      : rows

  const lastRow = rows[rows.length - 1]
  return ok({
    rows: displayRows,
    hasMore,
    nextCursor: hasMore && lastRow ? encodeActivityCursor(lastRow) : null,
  })
}
