'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps } from '@/db/live'
import { assignments, users } from '@/db/schema'
import { getSession } from '@/lib/session'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { roleBadgeTone, type ProjectRoleTone } from '@/lib/project-roles'

/**
 * The small card behind a person's name — who they are, what they are on, and
 * the two ways to reach them right now.
 *
 * FETCHED ON OPEN, never eagerly. A meeting page can name a dozen people and
 * the directory names all of them; loading every card up front would be a
 * dozen queries for information nobody asked to see. The card is a hover away,
 * so the query is a hover away.
 *
 * The phone number is not new exposure: person-header.tsx already gives every
 * signed-in viewer the same Call and WhatsApp buttons on a colleague's
 * profile. This brings that affordance to where the name is, rather than
 * making somebody navigate away from a meeting to place a call about it.
 */
export type PersonCardApp = {
  name: string
  slug: string
  role: string | null
  tone: ProjectRoleTone
  allocationPct: number
}

export type PersonCard = {
  id: string
  name: string
  title: string | null
  avatarUrl: string | null
  /** Null when they have not given one — the card shows no call buttons then. */
  phone: string | null
  apps: PersonCardApp[]
  /** Sum of their allocations, so the card can say "112%" without a second read. */
  totalPct: number
}

const input = z.object({ userId: z.uuid() })

export async function getPersonCard(raw: unknown): Promise<ActionResult<PersonCard>> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return err('Not a person')

  // Signed-in is the whole gate, matching the profile page this mirrors. A
  // narrower rule here would be theatre: the same viewer reaches the same
  // fields one click away on /people/[id].
  const session = await getSession()
  if (!session?.user) return err('Not allowed')

  const [person] = await db
    .select({
      id: users.id,
      name: users.name,
      title: users.title,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1)

  if (!person) return err('That person is no longer here')

  const rows = await db
    .select({
      name: liveApps.name,
      slug: liveApps.slug,
      role: assignments.role,
      allocationPct: assignments.allocationPct,
    })
    .from(assignments)
    .innerJoin(liveApps, eq(assignments.appId, liveApps.id))
    .where(eq(assignments.userId, parsed.data.userId))

  const apps = rows
    .map((row) => ({ ...row, tone: roleBadgeTone(row.role) }))
    .sort((a, b) => b.allocationPct - a.allocationPct)

  return ok({
    ...person,
    apps,
    totalPct: apps.reduce((sum, app) => sum + app.allocationPct, 0),
  })
}
