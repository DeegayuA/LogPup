// People tag the projects a day touched by writing them in brackets at the end
// of the note — "…for ML model training. [EV Charging App] [DERMS Web App]".
// That is a real convention already in the data, not one invented here, and it
// was rendering as literal square brackets in the middle of a paragraph.
//
// TRAILING RUN ONLY, deliberately. A note is prose written by a person, and
// brackets appear inside prose for ordinary reasons — "(1 out of 10)" is not a
// project, and neither is an aside someone bracketed mid-sentence. Only an
// unbroken run of [tags] at the very END of the note is treated as tagging;
// anything earlier stays exactly as typed. The cost of being wrong here is
// silently eating part of somebody's own account of their day, so the rule errs
// toward leaving text alone.
//
// An unmatched tag is KEPT as a plain pill rather than dropped or hidden. The
// person wrote it, it means something to them, and a project renamed last month
// should not make their note lose a word.

export type AppRef = { name: string; slug: string }

/** One bracketed project tag. `slug` is null when no app answers to that name. */
export type NoteAppTag = { label: string; slug: string | null }

export type TaggedNote = {
  /** The note with its trailing tag run removed, trimmed. */
  text: string
  /** Tags in the order they were written. */
  tags: NoteAppTag[]
}

/** `[Anything but a bracket]`, repeated to the end, ignoring spaces between. */
const TRAILING_TAGS = /(?:\s*\[[^[\]]+\])+\s*$/

export function splitNoteAppTags(note: string | null, apps: readonly AppRef[]): TaggedNote {
  if (!note) return { text: '', tags: [] }

  const match = note.match(TRAILING_TAGS)
  if (!match) return { text: note.trim(), tags: [] }

  const text = note.slice(0, match.index).trim()
  // A note that is ONLY tags keeps them as tags — there is no prose to lose,
  // and the alternative (treating the whole note as untagged text) would render
  // the brackets raw, which is the thing being fixed.
  const bySlug = new Map(apps.map((a) => [normalise(a.name), a.slug]))
  const tags: NoteAppTag[] = [...match[0].matchAll(/\[([^[\]]+)\]/g)].map((m) => {
    const label = m[1].trim()
    return { label, slug: bySlug.get(normalise(label)) ?? null }
  })

  return { text, tags }
}

/** Case- and space-insensitive, so "EV  charging app" still finds the project. */
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
