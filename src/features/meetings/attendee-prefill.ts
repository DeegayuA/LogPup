// Pure merge logic for the meeting form's attendee prefill: what the list
// should become when an app's team arrives, and when "Add everyone active"
// is clicked. Kept free of React/network on purpose, same as split-upcoming
// and recording-segments — meeting-form.tsx imports these to decide what the
// list becomes, not how to fetch a team.
//
// SWAP-WITH-PROVENANCE, not plain union and not ask-before-replace:
//  - Plain union means picking app A by mistake, then correcting to app B,
//    strands A's whole team on the meeting — the wrong five people survive
//    the correction, which is exactly the clobbering-in-reverse surprise.
//  - Ask-before-replace puts a confirm dialog in front of a *suggestion*;
//    a prefill cheap enough to offer must be cheap enough to take back.
//  - So instead: ids that arrived by prefill (and were never individually
//    chosen by a person) are tracked, and only THOSE are swapped for the new
//    team. Anything a human added — picker, quick-add phrase, "Add everyone"
//    — is manual and survives every app change.

export type AttendeeSelection = {
  /** The list as rendered/submitted, manual ids first in their kept order. */
  attendeeIds: string[]
  /** The subset of attendeeIds that only a prefill put there. */
  prefilledIds: string[]
}

/**
 * Re-offers an app team as the prefilled portion of the selection. `team` is
 * the new app's member ids ([] when "No app" is chosen — the suggestion then
 * simply retracts, manual picks stay). `roster` is every id the form can
 * actually render (the active-user list): assignments can point at
 * deactivated accounts, and an id outside the roster would sit invisibly in
 * the list and be submitted without ever having been on screen.
 */
export function applyTeamPrefill(
  selection: AttendeeSelection,
  team: string[],
  roster: string[],
): AttendeeSelection {
  const prefilled = new Set(selection.prefilledIds)
  const manual = selection.attendeeIds.filter((id) => !prefilled.has(id))
  const manualSet = new Set(manual)
  const rosterSet = new Set(roster)
  // A team member the user had already added by hand stays MANUAL — tagging
  // them prefilled here would silently remove them on the next app change.
  const suggested = [...new Set(team)].filter(
    (id) => rosterSet.has(id) && !manualSet.has(id),
  )
  return {
    attendeeIds: [...manual, ...suggested],
    prefilledIds: suggested,
  }
}

/**
 * "Add everyone active": the whole roster joins as MANUAL picks, not as a
 * prefill — a click on this button is a person's decision, so a later app
 * selection must not swap these people out from under it. Existing entries
 * keep their order; missing roster ids append in roster order.
 */
export function addEveryone(attendeeIds: string[], roster: string[]): string[] {
  const have = new Set(attendeeIds)
  return [...attendeeIds, ...roster.filter((id) => !have.has(id))]
}
