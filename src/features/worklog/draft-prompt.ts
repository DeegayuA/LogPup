/** One thing LogPup already saw this person do — see activity_log. */
export type DraftActivity = {
  verb: string
  entityType: string
  entityLabel: string
  appName: string | null
}

/**
 * The prompt behind "Draft with AI".
 *
 * Pure, so the guarantees that matter — first person, invents nothing, says
 * so when the day is blank — are pinned by a sibling test rather than
 * drifting inside a server action nobody can run offline.
 *
 * The draft is built from the person's OWN activity rows and is meant to be
 * edited, not accepted: it turns filling in a work log into correcting a
 * paragraph, which is the whole reason this exists.
 */
export function buildWorklogDraftPrompt(input: {
  name: string
  day: string
  activity: DraftActivity[]
  /**
   * When true, the prompt asks for JSON — `{"note": string, "percent":
   * number|null}` — so the action can also PROPOSE a percent instead of the
   * form silently defaulting one. Optional and false by default, so every
   * existing caller (and the tests pinning the plain-text draft) keeps the
   * prose prompt unchanged.
   */
  suggestPercent?: boolean
}): string {
  const lines = input.activity
    .map(
      (row) =>
        `- ${row.verb} ${row.entityType}: ${row.entityLabel}${row.appName ? ` (${row.appName})` : ''}`,
    )
    .join('\n')

  const recorded =
    input.activity.length > 0
      ? `What LogPup recorded them doing that day:\n${lines}\n`
      : 'LogPup has no recorded activity for them that day.\n'

  const shape = input.suggestPercent
    ? `Respond as JSON, exactly this shape: {"note": string, "percent": number | null}.
The note follows every rule below. The percent is a rough SUGGESTION for "how much of what they planned did they get through", 0-100 in steps of 5, judged only from how much recorded activity there is — a suggestion they will confirm or change, never a verdict. If there is no recorded activity, percent MUST be null.

`
    : ''

  return `You are drafting ${input.name}'s own work log entry for ${input.day}, which they will edit before saving.

${recorded}
${shape}Rules:
- Write in the FIRST PERSON, as ${input.name} ("Finished the login redirect fix…"). This is their entry, not a report about them.
- 2-4 short sentences. No bullet characters, no markdown, no headings.
- Use ONLY the activity above. NEVER invent work, hours, blockers or outcomes that are not listed.
- If there is no recorded activity, write one short line saying the day is not reflected in LogPup and they should describe it themselves. Do not guess what they did.
- This is a Sri Lankan team that code-switches between Sinhala and English. Write in English, but keep product, app and technical names exactly as they appear above.`
}
