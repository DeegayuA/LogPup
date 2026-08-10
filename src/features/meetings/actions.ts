'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, meetingAttendees, meetings } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { getTeamForApp } from '@/features/people/queries'

const meetingInput = z
  .object({
    appId: z.uuid().nullable(),
    title: z.string().min(2).max(120),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    agenda: z.string().max(2000).optional(),
    attendeeIds: z.array(z.uuid()).min(1),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'End time must be after the start time',
    path: ['endsAt'],
  })

const MAX_NOTES_LENGTH = 5000

async function requireSession() {
  const session = await auth()
  if (!session?.user) return null
  return session
}

/**
 * Walks an error's `.cause` chain looking for a Postgres foreign-key
 * violation (bogus appId/attendeeId). Same shape as the copy in
 * sprints/task-actions.ts — the neon-http driver / drizzle wrap the
 * underlying NeonDbError, so the `code`/`message` we want may be a few
 * levels down.
 */
function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (e.code === '23503') return true
    if (typeof e.message === 'string' && e.message.includes('foreign key')) return true
    current = e.cause
  }
  return false
}

async function meetingById(meetingId: string) {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId))
  return meeting ?? null
}

async function slugForApp(appId: string | null): Promise<string | null> {
  if (!appId) return null
  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId))
  return app?.slug ?? null
}

async function revalidateMeetingPaths(appId: string | null) {
  const slug = await slugForApp(appId)
  if (slug) revalidatePath('/apps/' + slug)
  revalidatePath('/meetings')
  revalidatePath('/')
}

function canManageMeeting(
  session: { user: { id: string; role: string } },
  meeting: { createdBy: string },
): boolean {
  return session.user.role === 'admin' || meeting.createdBy === session.user.id
}

export async function createMeeting(
  input: unknown,
): Promise<ActionResult<{ meetingId: string; calendarWarning?: string }>> {
  // Any authenticated member may create a meeting — no role check beyond a session.
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const parsed = meetingInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const { appId, title, startsAt, endsAt, agenda, attendeeIds } = parsed.data
  // Generated client-side (not via .returning()) so the id is known before
  // the batch runs — db.batch sends both inserts in one atomic round-trip
  // (neon-http has no transactions), so the attendee rows can't reference a
  // meeting id that isn't guaranteed to exist yet.
  const meetingId = crypto.randomUUID()

  try {
    await db.batch([
      db.insert(meetings).values({
        id: meetingId,
        appId,
        title,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        agenda: agenda || null,
        createdBy: session.user.id,
      }),
      db
        .insert(meetingAttendees)
        .values(attendeeIds.map((userId) => ({ meetingId, userId }))),
    ])
  } catch (error) {
    if (isForeignKeyViolation(error)) return err('Invalid app or attendee')
    throw error
  }

  await revalidateMeetingPaths(appId)
  // calendarWarning is unused until Task 15 wires Google Calendar in; typed
  // now so this signature never changes.
  return ok({ meetingId })
}

export async function updateMeetingNotes(meetingId: string, notes: string): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')
  if (notes.length > MAX_NOTES_LENGTH) return err('Notes are too long')

  const existing = await meetingById(meetingId)
  if (!existing) return err('Meeting not found')
  if (!canManageMeeting(session, existing)) return err('Not allowed')

  await db.update(meetings).set({ notes: notes || null }).where(eq(meetings.id, meetingId))

  await revalidateMeetingPaths(existing.appId)
  return ok(undefined)
}

export async function deleteMeeting(meetingId: string): Promise<ActionResult> {
  const session = await requireSession()
  if (!session) return err('Sign in required')

  const existing = await meetingById(meetingId)
  if (!existing) return err('Meeting not found')
  if (!canManageMeeting(session, existing)) return err('Not allowed')

  await db.delete(meetings).where(eq(meetings.id, meetingId))

  await revalidateMeetingPaths(existing.appId)
  return ok(undefined)
}

/** Thin server-action wrapper over getTeamForApp so the client meeting form
 * can prefill attendees when an app is selected. */
export async function teamForApp(appId: string): Promise<{ id: string; name: string }[]> {
  const session = await requireSession()
  if (!session) return []

  const team = await getTeamForApp(appId)
  return team.map((member) => ({ id: member.userId, name: member.name }))
}
