/**
 * Every reason a day was not an ordinary working day — the ONE list.
 *
 * Until this module existed the vocabulary lived in three places that had to
 * agree by hand: the pg enum, a label map inside a client component, and a
 * `SELF_DECLARABLE` tuple inside a `'use server'` file. Adding a kind meant
 * editing all three, and the one that got forgotten decided whether the kind
 * was unreadable, unpickable or unsavable.
 *
 * PURE AND SYNCHRONOUS, the same contract as entries.ts and coverage.ts. It
 * mirrors the `absence_kind` pg enum rather than importing the schema, so the
 * picker, the label map and the server-side allowlist can all read it without
 * pulling drizzle into a client bundle. The schema is still the source of
 * truth for what the column can HOLD; this is the source of truth for what
 * each value MEANS.
 *
 * THE PART-DAY KINDS DO NOT EXEMPT A DAY. `half_day` and `short_leave` are
 * real and they are filed and approved like anything else — but a day
 * somebody worked half of is a day they can log half of, so it stays owed and
 * `exemptsWholeDay` says so. Letting them through the coverage exemption would
 * silently write off a whole day for two hours of dentist, which is the exact
 * fiction the approval workflow exists to prevent. Fractional exemption is a
 * separate design in coverage.ts and this module deliberately does not
 * pretend to have it.
 */

export const ABSENCE_GROUPS = [
  'Time off',
  'Part of a day',
  'Working, elsewhere',
  'Filed for you',
] as const
export type AbsenceGroup = (typeof ABSENCE_GROUPS)[number]

export type AbsenceKindDefinition = {
  id: AbsenceKind
  /** What a person reads, in the picker and everywhere it is played back. */
  label: string
  /** One line under the label in the picker. */
  hint: string
  /** Which heading it sits under, so a picker of fourteen is still scannable. */
  group: AbsenceGroup
  /**
   * Whether a person may file it ABOUT THEMSELVES.
   *
   * `no_work_assigned` is false on purpose: it is a statement about the studio
   * failing to give somebody work, and a person filing it against themselves
   * turns a grievance into a form field. `other` is the admin escape hatch.
   */
  selfDeclarable: boolean
  /**
   * Whether an APPROVED absence of this kind removes the day from what the
   * person owes. False for the part-day kinds — see the module comment.
   */
  exemptsWholeDay: boolean
}

/**
 * Mirrors the `absence_kind` pg enum, in PICKER ORDER rather than in the
 * enum's physical order — nothing in src/ sorts by the column, and the order
 * somebody meets these in is a product decision, not a storage one.
 *
 * The statutory Sri Lankan entitlements come first (Shop and Office Employees
 * Act: annual, casual, sick), then the rest of a day off, then the part-day
 * kinds, then the ones that mean "I was working, just not here".
 */
export const ABSENCE_KIND_DEFINITIONS = [
  {
    id: 'annual',
    label: 'Annual leave',
    hint: 'Your statutory annual entitlement.',
    group: 'Time off',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'casual',
    label: 'Casual leave',
    hint: 'The separate casual entitlement — not annual.',
    group: 'Time off',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'sick',
    label: 'Sick leave',
    hint: 'Illness — yours, or somebody you care for.',
    group: 'Time off',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'lieu',
    label: 'Off in lieu',
    hint: 'A day back for a holiday or weekend you worked.',
    group: 'Time off',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'bereavement',
    label: 'Bereavement leave',
    hint: 'A death in the family. Nobody needs the details.',
    group: 'Time off',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'parental',
    label: 'Maternity / paternity leave',
    hint: 'A birth or an adoption.',
    group: 'Time off',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'unpaid',
    label: 'No-pay leave',
    hint: 'Leave beyond your entitlement.',
    group: 'Time off',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'half_day',
    label: 'Half day',
    hint: 'You worked the other half — so the day still wants a log.',
    group: 'Part of a day',
    selfDeclarable: true,
    exemptsWholeDay: false,
  },
  {
    id: 'short_leave',
    label: 'Short leave (excuse)',
    hint: 'An hour or two — late in, early out, an appointment.',
    group: 'Part of a day',
    selfDeclarable: true,
    exemptsWholeDay: false,
  },
  {
    id: 'training',
    label: 'Training',
    hint: 'A course, a workshop, a certification.',
    group: 'Working, elsewhere',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'duty',
    label: 'Duty leave',
    hint: 'Studio business away from the studio — a client site, a conference.',
    group: 'Working, elsewhere',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'other_project',
    label: 'On another project',
    hint: 'Lent to work that is not on your board.',
    group: 'Working, elsewhere',
    selfDeclarable: true,
    exemptsWholeDay: true,
  },
  {
    id: 'no_work_assigned',
    label: 'No work assigned',
    hint: 'Nobody had work for you. An admin files this one, not you.',
    group: 'Filed for you',
    selfDeclarable: false,
    exemptsWholeDay: true,
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'The admin escape hatch, with a reason attached.',
    group: 'Filed for you',
    selfDeclarable: false,
    exemptsWholeDay: true,
  },
] as const

export type AbsenceKind = (typeof ABSENCE_KIND_DEFINITIONS)[number]['id']

/** Every kind the column can hold, for reading back what was filed. */
export const ABSENCE_KIND_LABELS = Object.fromEntries(
  ABSENCE_KIND_DEFINITIONS.map((kind) => [kind.id, kind.label]),
) as Record<AbsenceKind, string>

/**
 * What a person may declare about themselves. `absence-actions.ts` validates
 * against this same array server-side, so the picker can only ever be
 * narrower than what is accepted, never wider.
 */
export const SELF_DECLARABLE_KINDS: readonly AbsenceKind[] = ABSENCE_KIND_DEFINITIONS.filter(
  (kind) => kind.selfDeclarable,
).map((kind) => kind.id)

/** The self-declarable kinds under their headings, in picker order. */
export function selfDeclarableGroups(): {
  group: AbsenceGroup
  kinds: AbsenceKindDefinition[]
}[] {
  const out: { group: AbsenceGroup; kinds: AbsenceKindDefinition[] }[] = []
  for (const kind of ABSENCE_KIND_DEFINITIONS) {
    if (!kind.selfDeclarable) continue
    const bucket = out.find((entry) => entry.group === kind.group)
    if (bucket) bucket.kinds.push(kind)
    else out.push({ group: kind.group, kinds: [kind] })
  }
  return out
}

/** An unknown value — a kind in the enum and not yet in this list — never crashes a render. */
export function absenceKindLabel(kind: string): string {
  return ABSENCE_KIND_LABELS[kind as AbsenceKind] ?? kind
}

const WHOLE_DAY = new Set<string>(
  ABSENCE_KIND_DEFINITIONS.filter((kind) => kind.exemptsWholeDay).map((kind) => kind.id),
)

/** See the module comment: half days and short leave do not write off a day. */
export function exemptsWholeDay(kind: string): boolean {
  return WHOLE_DAY.has(kind)
}

/**
 * The absences that may be handed to `absenceDays` for a coverage denominator.
 *
 * CALL THIS AT EVERY EXEMPTION SITE. `absenceDays` clips ranges to a window and
 * deliberately does not decide which absences count — its own comment says
 * that is the caller's decision — so without this filter an approved half day
 * would exempt the whole day everywhere at once: the calendar, the ledger, the
 * streak and /intel.
 */
export function exemptingAbsences<T extends { kind: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => exemptsWholeDay(row.kind))
}

/**
 * Words a person might type for each kind, for the free-text reader.
 *
 * MATCHED LONGEST-FIRST by the caller, so "short leave" wins over "leave" and
 * "casual leave" over "casual". Deliberately conservative: a phrase here turns
 * a line of somebody's own writing into a leave request that goes to their
 * manager, so it lists only spellings that mean one thing. Bare "off" is
 * absent for that reason — "off to the client site" is not a day off.
 */
export const ABSENCE_KIND_PHRASES: Record<AbsenceKind, readonly string[]> = {
  annual: ['annual leave', 'vacation'],
  casual: ['casual leave', 'casual'],
  sick: ['sick leave', 'medical leave', 'sick'],
  lieu: ['off in lieu', 'lieu leave', 'in lieu'],
  bereavement: ['bereavement leave', 'bereavement', 'funeral leave'],
  parental: ['maternity leave', 'paternity leave', 'maternity', 'paternity'],
  unpaid: ['no pay leave', 'no-pay leave', 'unpaid leave', 'nopay'],
  half_day: ['half day', 'half-day'],
  short_leave: ['short leave', 'excuse leave'],
  training: ['training', 'workshop day'],
  duty: ['duty leave', 'official duty'],
  other_project: ['another project', 'other project'],
  no_work_assigned: [],
  other: [],
}
