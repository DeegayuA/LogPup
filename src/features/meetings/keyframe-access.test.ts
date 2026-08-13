import { describe, expect, it } from 'vitest'
import { canServeKeyframe } from './keyframe-access'

describe('canServeKeyframe', () => {
  it('admin previewing a trashed frame from the admin Trash card: yes', () => {
    expect(
      canServeKeyframe({ isAdmin: true, frameDeleted: true, meetingDeleted: true, canReadMeeting: true }),
    ).toBe(true)
  })

  it('member, live frame, live meeting, entitled to read the meeting: yes', () => {
    expect(
      canServeKeyframe({ isAdmin: false, frameDeleted: false, meetingDeleted: false, canReadMeeting: true }),
    ).toBe(true)
  })

  it('member, trashed frame (meeting still live): no', () => {
    expect(
      canServeKeyframe({ isAdmin: false, frameDeleted: true, meetingDeleted: false, canReadMeeting: true }),
    ).toBe(false)
  })

  it('member, live frame but the meeting itself is trashed: no', () => {
    expect(
      canServeKeyframe({ isAdmin: false, frameDeleted: false, meetingDeleted: true, canReadMeeting: true }),
    ).toBe(false)
  })

  it('member without read access to the meeting (not admin/creator/PM/attendee): no', () => {
    expect(
      canServeKeyframe({ isAdmin: false, frameDeleted: false, meetingDeleted: false, canReadMeeting: false }),
    ).toBe(false)
  })

  // The route returns 404 before this function is ever reached when there is
  // no session (auth() short-circuit) — canReadMeeting can only be computed
  // from a signed-in user. This case is included anyway, as defense in
  // depth: with no session there is no user to satisfy canReadMeetingIntel,
  // so canReadMeeting is false, and the function must still say no even if
  // every other flag looks servable.
  it('no session: canReadMeeting is unsatisfiable, so no even for an otherwise-live frame', () => {
    expect(
      canServeKeyframe({ isAdmin: false, frameDeleted: false, meetingDeleted: false, canReadMeeting: false }),
    ).toBe(false)
  })

  it('admin bypasses liveness but still requires canReadMeeting', () => {
    expect(
      canServeKeyframe({ isAdmin: true, frameDeleted: true, meetingDeleted: true, canReadMeeting: false }),
    ).toBe(false)
  })
})
