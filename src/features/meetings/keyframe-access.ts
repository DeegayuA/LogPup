import { isAdminRole } from '@/features/auth/capabilities'
/**
 * Pure authorization decision for serving one meeting keyframe image through
 * the /api/meeting-keyframes proxy (src/app/api/meeting-keyframes/[...path]/
 * route.ts). Split out on purpose: this repo has no route-handler test
 * harness (see vitest.config.ts's test.include and the absence of any
 * src/app/api/**\/*.test.ts), so a pure function is the only way to put the
 * authorization matrix under a real unit test — the route itself stays a
 * thin wrapper that resolves the four booleans below and calls this.
 *
 * Soft deletes are live (see src/db/live.ts): normally a keyframe is only
 * servable when BOTH the screenshot row and its meeting are live. The one
 * legitimate exception is an admin previewing a trashed keyframe from the
 * admin Trash card — admins bypass both liveness checks, but still have to
 * pass canReadMeeting (which canReadMeetingIntel in ai-actions.ts already
 * grants unconditionally to an admin; the parameter exists here so this
 * function stays correct even if that rule ever changes, rather than baking
 * in an unconditional "isAdmin always wins").
 */
export type KeyframeAccessInput = {
  /** isAdminRole(session.user.role). */
  isAdmin: boolean
  /** meeting_screenshots.deleted_at IS NOT NULL for this frame. */
  frameDeleted: boolean
  /** meetings.deleted_at IS NOT NULL for the frame's meeting. */
  meetingDeleted: boolean
  /**
   * canReadMeetingIntel(user, meeting) — computed by the caller from a RAW
   * meeting read (not liveMeetings), because a trashed meeting still has to
   * resolve here so `meetingDeleted` above can be observed at all.
   */
  canReadMeeting: boolean
}

export function canServeKeyframe({
  isAdmin,
  frameDeleted,
  meetingDeleted,
  canReadMeeting,
}: KeyframeAccessInput): boolean {
  if (!canReadMeeting) return false
  return isAdmin || (!frameDeleted && !meetingDeleted)
}
