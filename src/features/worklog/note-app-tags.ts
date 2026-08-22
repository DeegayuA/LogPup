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

/**
 * Whether the note already tags this project.
 *
 * CASE-INSENSITIVE, and that matters: the chip's own "Logged / Unfilled"
 * reading has always been case-insensitive while the tagging handler tested
 * `note.includes('[Exact Case]')`. A note carrying `[unilever project]`
 * therefore showed as Logged AND accepted a second `[Unilever Project]` on
 * top of it. One rule now answers both questions.
 */
export function noteHasAppTag(note: string, appName: string): boolean {
  return note.toLowerCase().includes(`[${appName.toLowerCase()}]`)
}

/**
 * Add the project's tag to the note, or take it back out.
 *
 * THE CHIPS COULD ONLY EVER BE TURNED ON. Clicking a tagged project said
 * "already tagged in this work log" and did nothing, so the only way to undo a
 * misclick was to find the bracketed text in your own prose and delete it by
 * hand — on a control that otherwise looks and behaves exactly like a toggle.
 *
 * Removal takes out EVERY occurrence, not the first: a note that ended up with
 * the tag twice (which the case-sensitivity bug above could produce) must come
 * back clean in one click rather than needing two, the second of which would
 * look like the toggle failing.
 *
 * Whitespace is repaired rather than left behind — a removed tag must not
 * leave a hanging blank line or a double space in the middle of a sentence
 * somebody wrote. Trailing space is preserved on ADD, because the caret lands
 * after it and the person keeps typing.
 */
export function toggleNoteAppTag(note: string, appName: string): string {
  const tag = `[${appName}]`

  if (!noteHasAppTag(note, appName)) {
    const trimmed = note.trim()
    return trimmed ? `${trimmed}\n${tag} ` : `${tag} `
  }

  // Escaped: project names legitimately contain regex metacharacters — this
  // studio has one called "SCADA | CEB Assist", whose bare pipe would make the
  // pattern an alternation matching almost anything.
  const escaped = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return note
    .replace(new RegExp(`\\[${escaped}\\]`, 'gi'), '')
    // Collapse the run of spaces/tabs a removed mid-sentence tag leaves.
    .replace(/[ \t]{2,}/g, ' ')
    // …and the blank line a removed tag-on-its-own-line leaves.
    .replace(/\n[ \t]*\n+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}
