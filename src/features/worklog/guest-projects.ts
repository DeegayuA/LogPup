// A "guest" project is one the person is NOT assigned to but worked on anyway
// — a tech lead unblocking somebody else's app for an afternoon. The write
// paths never cared about assignment; only the pickers did, so this module
// exists to split the studio's other projects into the two ways the form
// shows them.
//
// TAGGED guests earn a chip: once the note names a project, that is a fact
// about the day, and the chip is the same way back off it that assigned
// projects get. UNTAGGED guests stay behind a picker — a person with three
// assignments must not meet thirty studio apps every morning. And a guest is
// never "unfilled": unfilled means expected-and-empty, and nobody expects
// work from a helper.

import { noteHasAppTag } from '@/features/worklog/note-app-tags'

/**
 * Split the non-assigned projects by whether the note already tags them.
 *
 * Uses `noteHasAppTag` — the same rule the assigned chips and the tag toggle
 * read — so a guest chip can never disagree with the note that put it there.
 * Order is preserved within each half (the query sorts by name).
 */
export function partitionGuestApps<T extends { name: string }>(
  note: string,
  guests: readonly T[],
): { tagged: T[]; available: T[] } {
  const tagged: T[] = []
  const available: T[] = []
  for (const app of guests) {
    ;(noteHasAppTag(note, app.name) ? tagged : available).push(app)
  }
  return { tagged, available }
}
