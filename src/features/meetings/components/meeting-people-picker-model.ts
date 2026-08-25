// Pure logic behind MeetingPeoplePicker — grouping, ordering, dedup,
// option-building and every label the trigger or a chip can show. No React,
// no DOM: the component in meeting-people-picker.tsx is a thin rendering
// shell over these functions, which is what lets the interesting behaviour be
// tested at all (this repo has no jsdom setup — see vitest.config.ts, which
// includes only `src/**/*.test.ts`).
//
// Same split as note-timeline-model.ts / note-timeline.tsx and
// meeting-panels-model.ts / meeting-panels.tsx.

/**
 * The one person shape every meeting surface already has. Both
 * `AttendeeRef` (features/meetings/followups.ts) and `MentionUser`
 * (components/mention-textarea.tsx) are `{ id, name }`, so both are assignable
 * to this without a conversion at the call site — deliberately, so swapping
 * this picker into an existing surface is a component swap and not a data
 * refactor.
 */
export type PickablePerson = {
  id: string
  name: string
  /** Optional second line — a role, a team. Searchable, and shown under the name. */
  hint?: string
  disabled?: boolean
}

/**
 * The sentinel for "Nobody / unassigned".
 *
 * Deliberately the SAME literal as `UNASSIGNED` in action-item-board.tsx: a
 * caller swapping its Select for this picker keeps writing and reading the
 * exact same string, so nothing round-trips differently on the wire. The
 * shape (leading + trailing double underscores) is one no uuid can take, so
 * it can never collide with a real person id. Asserted in the test — if the
 * two ever drift apart, that is a silent data bug, not a visual one.
 */
export const UNASSIGNED_VALUE = '__unassigned__'

/** Which tier a person is offered from. */
export type PersonGroup = 'attendee' | 'workspace'

export const ATTENDEE_GROUP_HEADING = 'In this meeting'
export const WORKSPACE_GROUP_HEADING = 'Elsewhere in the workspace'

export const NO_MATCH_TEXT = 'Nobody by that name.'
export const EMPTY_POOL_TEXT = 'No people to pick from yet.'
export const LOADING_TEXT = 'Finding people…'
export const DEFAULT_UNASSIGNED_LABEL = 'Nobody / unassigned'

/**
 * What the trigger says when it holds an id it cannot name — a deactivated
 * user, or a pool that has not loaded yet.
 *
 * Never "Unassigned": that is a claim about the DATA ("nobody is on this")
 * and it would be false. And never the id itself. This says the true thing —
 * somebody is on it, and this control does not know who.
 */
export const UNKNOWN_PERSON_LABEL = 'Someone not listed'

/**
 * An option ready for either renderer: `value`/`label`/`hint`/`disabled` make
 * it structurally a `SearchSelectOption`, so it can be handed straight to
 * `<SearchSelect>` where a flat list is enough; `group`/`groupHeading`/`detail`
 * are the extra structure MeetingPeoplePicker uses to draw real headings.
 *
 * `hint` folds the group heading into the searchable text on purpose — in a
 * flat SearchSelect there are no headings, so "meeting" has to find the
 * attendees somehow. Under real headings the component renders `detail`
 * instead, because repeating "In this meeting" under every name inside a
 * section already titled "In this meeting" is noise.
 */
export type PeopleOption = {
  value: string
  label: string
  hint?: string
  disabled?: boolean
  group: PersonGroup
  groupHeading: string
  /** The person's own hint (role, team), without the group heading folded in. */
  detail?: string
}

export type PeopleOptionGroup = {
  group: PersonGroup
  heading: string
  options: PeopleOption[]
}

/**
 * Meeting attendees first, then anyone else in the wider pool — deduped, so
 * the common case (an attendee who is also in the workspace list) is offered
 * once, not twice.
 *
 * Same contract as `buildAssigneePool` in action-item-board.tsx, including
 * the `people ?? attendees` fallback, so this is a drop-in for it. It also
 * dedupes WITHIN each list, which that one does not: a meeting whose attendee
 * rows contain the same user twice (a re-invite, a merged account) used to
 * produce two identical rows in the picker.
 */
export function buildPeoplePool(
  attendees: PickablePerson[],
  people?: PickablePerson[],
): PickablePerson[] {
  const pool = people ?? attendees
  const seen = new Set<string>()
  const out: PickablePerson[] = []
  for (const person of [...attendees, ...pool]) {
    if (seen.has(person.id)) continue
    seen.add(person.id)
    out.push(person)
  }
  return out
}

function composeHint(person: PickablePerson, groupHeading: string): string {
  return person.hint ? `${person.hint} · ${groupHeading}` : groupHeading
}

function toOption(person: PickablePerson, group: PersonGroup): PeopleOption {
  const groupHeading = group === 'attendee' ? ATTENDEE_GROUP_HEADING : WORKSPACE_GROUP_HEADING
  return {
    value: person.id,
    label: person.name,
    hint: composeHint(person, groupHeading),
    disabled: person.disabled,
    group,
    groupHeading,
    detail: person.hint,
  }
}

export type BuildPeopleOptionsInput = {
  /** People actually in the meeting. Offered first. */
  attendees: PickablePerson[]
  /**
   * The wider workspace pool. Offered second, and NOT blocked: the meeting AI
   * routinely names someone who was not in the room ("coordinate subdomain
   * creation with Rahumat"), and a picker that refuses to assign that task to
   * the person it names is a picker that makes the task unassignable.
   */
  people?: PickablePerson[]
  /**
   * People already picked. Any of them missing from both lists is appended to
   * the workspace group so their NAME still resolves — this is the whole
   * "renders Unassigned for a real person" bug: an id whose person was never
   * in the option list has nothing to render, and the fallback used to be the
   * unassigned label.
   */
  selected?: PickablePerson[]
}

/** Attendees first, everyone else after, deduped, each tagged with its group. */
export function buildPeopleOptions({
  attendees,
  people,
  selected,
}: BuildPeopleOptionsInput): PeopleOption[] {
  const seen = new Set<string>()
  const options: PeopleOption[] = []

  const push = (person: PickablePerson, group: PersonGroup) => {
    if (seen.has(person.id)) return
    seen.add(person.id)
    options.push(toOption(person, group))
  }

  for (const person of attendees) push(person, 'attendee')
  for (const person of people ?? []) push(person, 'workspace')
  // Anyone already chosen but absent from both lists. By definition not an
  // attendee (the attendee loop above would have claimed them), so they land
  // in the workspace group rather than being invented into the meeting.
  for (const person of selected ?? []) {
    if (person.id === UNASSIGNED_VALUE) continue
    push(person, 'workspace')
  }

  return options
}

/** Splits built options into rendered sections, dropping any section that is empty. */
export function groupPeopleOptions(options: PeopleOption[]): PeopleOptionGroup[] {
  const order: PersonGroup[] = ['attendee', 'workspace']
  return order
    .map((group) => ({
      group,
      heading: group === 'attendee' ? ATTENDEE_GROUP_HEADING : WORKSPACE_GROUP_HEADING,
      options: options.filter((option) => option.group === group),
    }))
    .filter((section) => section.options.length > 0)
}

/**
 * Matching, identical to SearchSelect's own filter: the words a person can
 * SEE are the words that match, while the value stays a database id. Kept as
 * a function here rather than inlined so both renderers cannot drift into two
 * slightly different notions of "matches".
 */
export function matchesPersonQuery(
  option: { label: string; hint?: string },
  search: string,
): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(needle)
}

/* --- the sentinel, in both directions ---------------------------------- */

/** `null` -> the sentinel, for a control whose value must be a non-empty string. */
export function toPickerValue(id: string | null | undefined): string {
  return id ?? UNASSIGNED_VALUE
}

/** The sentinel -> `null`, for callers that store "no assignee" as null. */
export function fromPickerValue(value: string | null | undefined): string | null {
  if (!value || value === UNASSIGNED_VALUE) return null
  return value
}

/* --- labels: the trigger must never show a uuid ------------------------- */

export type ResolveLabelOptions = {
  /**
   * A name the caller already has for the current id (e.g. a suggestion's
   * `suggestedUserName`) — used when the pool has not loaded or no longer
   * contains that person.
   */
  fallbackName?: string | null
  unassignedLabel?: string
}

/**
 * What the trigger renders for the current value.
 *
 * The rule this exists to enforce: NEVER the raw value. Base UI's Select
 * renders `value` verbatim unless it is given an items map or a function
 * child (see ActionItemAssignee's `<SelectValue>{() => …}</SelectValue>` in
 * action-item-board.tsx) — this picker does not use Base UI Select, but the
 * same failure is one careless `{value}` away in any combobox, so the label
 * is computed here and asserted in the test.
 */
export function resolveTriggerLabel(
  value: string | null | undefined,
  options: PeopleOption[],
  { fallbackName, unassignedLabel = DEFAULT_UNASSIGNED_LABEL }: ResolveLabelOptions = {},
): string {
  const id = fromPickerValue(value)
  if (id === null) return unassignedLabel
  const match = options.find((option) => option.value === id)
  if (match) return match.label
  const trimmed = fallbackName?.trim()
  if (trimmed) return trimmed
  return UNKNOWN_PERSON_LABEL
}

export type ChipLabel = { value: string; label: string }

/**
 * One chip per selected id, in SELECTION order — not pool order. Someone who
 * adds Rahumat and then Nadeesha should see them in that order; re-sorting
 * chips under people as they pick is the kind of small betrayal that makes a
 * control feel like it is arguing.
 */
export function resolveChipLabels(
  values: string[],
  options: PeopleOption[],
  { fallbackNames }: { fallbackNames?: Record<string, string> } = {},
): ChipLabel[] {
  const seen = new Set<string>()
  const chips: ChipLabel[] = []
  for (const raw of values) {
    const id = fromPickerValue(raw)
    if (id === null || seen.has(id)) continue
    seen.add(id)
    chips.push({
      value: id,
      label: resolveTriggerLabel(id, options, { fallbackName: fallbackNames?.[id] }),
    })
  }
  return chips
}

/**
 * Add or remove one id, preserving the order the rest were picked in.
 * Appending on add is what makes `resolveChipLabels` stable.
 */
export function toggleSelection(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
}

/* --- states, because a list is never allowed to just be blank ----------- */

export type PickerListState = 'loading' | 'empty-pool' | 'ready'

/**
 * Loading and "there is genuinely nobody" are different facts and must read
 * differently — an empty popup that means "still fetching" is the state bug
 * this repo keeps banning.
 */
export function resolveListState({
  loading,
  poolSize,
}: {
  loading?: boolean
  poolSize: number
}): PickerListState {
  if (loading) return 'loading'
  if (poolSize === 0) return 'empty-pool'
  return 'ready'
}

/**
 * One initial for the avatar. No avatarUrl is threaded this far (attendees
 * and mention users are both `{ id, name }`), so this is initials-only rather
 * than a broken image request — same call as PersonInitial in
 * action-item-board.tsx.
 */
export function personInitial(name: string | null | undefined): string {
  const trimmed = name?.trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 1).toUpperCase()
}
