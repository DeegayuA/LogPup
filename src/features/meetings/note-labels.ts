// Neutral, content-free labels for a deleted note segment / screen keyframe —
// used as the activity-trail entityLabel (src/features/meetings/ai-actions.ts)
// and the trash-listing row label (src/features/admin/trash-grouping.ts).
//
// A note segment can carry a voice transcript or written notes; a screen
// keyframe can show whatever was on someone's screen — code, a dashboard, a
// private doc. Either trail names WHERE it lived (which meeting), never WHAT
// was in it: a retraction must not re-broadcast what it retracts.
//
// Deliberately dependency-free — imports nothing — so both importers can
// share this ONE implementation without either dragging the other's
// dependency graph along: ai-actions.ts's top-level `@/lib/auth` import pulls
// in next-auth/next/server, which trash-grouping.ts must stay free of to
// remain unit-testable with zero mocks (see its own file header). Before this
// module existed, each side carried its own copy of these two functions with
// nothing to catch them drifting apart; trash-grouping.test.ts now asserts
// against THIS module's output directly instead of a hardcoded string.
export const noteSegmentDeleteLabel = (meetingTitle: string) => `a note segment in ${meetingTitle}`
export const keyframeDeleteLabel = (meetingTitle: string) => `a screen keyframe in ${meetingTitle}`
