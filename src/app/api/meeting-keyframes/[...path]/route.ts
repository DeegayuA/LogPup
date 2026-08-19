import { get } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { meetingScreenshots, meetings } from '@/db/schema'
import { canReadMeetingIntel } from '@/features/meetings/ai-actions'
import { canServeKeyframe } from '@/features/meetings/keyframe-access'
import { isAdminRole } from '@/features/auth/capabilities'

/**
 * Streams one screen-share keyframe out of the PRIVATE blob store.
 *
 * Modeled on src/app/api/avatar/[...path]/route.ts (same private-store
 * proxy pattern — the store also holds encrypted DB backups, so nothing in
 * it can ever be public), with one extra layer: a keyframe is a screen
 * capture of a meeting, at least as sensitive as the meeting's notes, so
 * this route re-checks the same entitlement getMeetingIntel does
 * (canReadMeetingIntel) rather than trusting "signed in" alone.
 *
 * Every "not permitted" outcome — no session, unknown pathname, wrong
 * shape, soft-deleted, or simply not entitled to the meeting — returns 404,
 * never 401/403. That keeps the response shape identical whether the frame
 * doesn't exist or the caller just isn't allowed to see it, so a probe can't
 * use the status code to learn which.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth()
  if (!session?.user) return new Response('Not found', { status: 404 })

  const { path } = await params
  // Same single-encoded-segment trick as the avatar route and
  // keyframeProxyUrl (ai-actions.ts): the stored pathname contains '/' and
  // travels as one encodeURIComponent'd segment, decoded and reconstructed
  // here rather than split across multiple.
  const pathname = path.map(decodeURIComponent).join('/')
  if (!pathname.startsWith('meeting-keyframes/') || pathname.includes('..')) {
    return new Response('Not found', { status: 404 })
  }

  // RAW read of meeting_screenshots and meetings — deliberately not
  // liveScreenshots/liveMeetings. An admin previewing a trashed keyframe
  // from the admin Trash card needs to see a soft-deleted frame and/or a
  // soft-deleted meeting, and even a non-admin's "is the MEETING trashed"
  // check needs the real meetings row, not one liveMeetings has already
  // filtered out. canServeKeyframe below is the actual authorization
  // decision (and is unit tested directly in keyframe-access.test.ts) — this
  // read only gathers the facts it needs. See src/db/live.test.ts's
  // ALLOWLIST for the matching admin-preview exception.
  //
  // Exact-match parameterised lookup on blobPathname: this value is
  // user-supplied (comes off the URL), so it is never interpolated into SQL
  // and never handed to the blob store below until it has matched a row
  // here — otherwise this route would be an open proxy to any blob in the
  // private store.
  const [row] = await db
    .select({
      frameDeletedAt: meetingScreenshots.deletedAt,
      meetingId: meetings.id,
      createdBy: meetings.createdBy,
      appId: meetings.appId,
      meetingDeletedAt: meetings.deletedAt,
    })
    .from(meetingScreenshots)
    .innerJoin(meetings, eq(meetingScreenshots.meetingId, meetings.id))
    .where(eq(meetingScreenshots.blobPathname, pathname))
    .limit(1)

  if (!row) return new Response('Not found', { status: 404 })

  const isAdmin = isAdminRole(session.user.role)
  const canReadMeeting = await canReadMeetingIntel(session.user, {
    id: row.meetingId,
    createdBy: row.createdBy,
    appId: row.appId,
  })

  const allowed = canServeKeyframe({
    isAdmin,
    frameDeleted: row.frameDeletedAt !== null,
    meetingDeleted: row.meetingDeletedAt !== null,
    canReadMeeting,
  })
  if (!allowed) return new Response('Not found', { status: 404 })

  let blob: Awaited<ReturnType<typeof get>>
  try {
    blob = await get(pathname, { access: 'private' })
  } catch {
    return new Response('Not found', { status: 404 })
  }
  if (!blob) return new Response('Not found', { status: 404 })

  return new Response(blob.stream, {
    headers: {
      'Content-Type': blob.headers?.get('content-type') ?? 'image/jpeg',
      // Each keyframe gets a fresh random pathname (see uploadMeetingKeyframe
      // in ai-actions.ts), so a cached copy is only ever the image that
      // pathname has always pointed at. Private: this is meeting content
      // behind auth + entitlement, never a shared CDN cache.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
