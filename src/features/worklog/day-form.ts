/**
 * Why the day cannot be saved yet, in the words the person reads.
 *
 * THE BUTTON USED TO JUST BE DEAD. `canSave = percent !== null && dirty` with
 * `disabled={!canSave}` and no text anywhere saying which of the two was
 * missing — so somebody who dictated or drafted a full paragraph reached for
 * Save, got nothing, and had no way to learn that the score was the missing
 * piece. The hours card two elements down has stated its blocking reason in
 * the server's own words since entry-form.ts landed; this is the same rule
 * applied to the other half of the day.
 *
 * Pure and synchronous, like entries.ts and entry-form.ts: the reason is data
 * in, sentence out, so the state that used to be silent is a test.
 */

export type DayFormFields = {
  /** The self-scored percent, or null while nothing is chosen. */
  percent: number | null
  /** Whether anything differs from what is already saved. */
  dirty: boolean
}

/**
 * The sentence to show beside a disabled Save, or null when it is live.
 *
 * "Nothing to save" is deliberately a DIFFERENT sentence from the missing
 * score: one means the person has not answered yet, the other that they have
 * and it is already stored. Collapsing them into one disabled button is how
 * "did my note save?" becomes unanswerable.
 */
export function dayFormProblem(fields: DayFormFields): string | null {
  if (fields.percent === null) {
    return 'Score the day first — a note on its own is not a log.'
  }
  if (!fields.dirty) return 'Nothing to save — this is what is already stored.'
  return null
}
