/**
 * What a departing person still holds, and what may be done with it.
 *
 * Offboarding closes their ACCESS, but nothing moves their WORK — and once
 * work_schedules exists, a leaver whose schedule is never closed accrues a
 * `missing` day every working day forever, dragging every org-level coverage
 * number with them.
 */

export const TRANSFERABLE_GROUPS = [
  'assignments',
  'app_roles',
  'tasks',
  'meetings',
  'followups',
  'change_requests',
  'absences',
  'app_grants',
] as const

export type TransferableGroup = (typeof TRANSFERABLE_GROUPS)[number]

/**
 * What must NEVER move, with the reason stated in place.
 *
 * The UI shows these where a reader would otherwise look for the option, so
 * "why can't I reassign their work logs" is answered before it is asked.
 */
export const NON_TRANSFERABLE: readonly { table: string; reason: string }[] = [
  {
    table: 'daily_worklogs',
    reason:
      'A first-person record. Worklog writes are self-only — there is no ' +
      'worklog.write.any action for any seat — so reassigning one would ' +
      'rewrite what somebody said they did.',
  },
  {
    table: 'sprint_checkins',
    reason:
      'The same shape as a worklog: an answer somebody gave about their own ' +
      'week. 0% is an answer; absence is the lack of one.',
  },
  {
    table: 'webauthn_credentials',
    reason:
      'Access keys bound to a person and a device. Transferring one would ' +
      'hand somebody else the ability to sign in as the leaver.',
  },
  {
    table: 'gemini_keys',
    reason:
      'Their own API credentials, billed to them. Moving a key moves a bill ' +
      'and a secret at the same time.',
  },
]

export type Share = { userId: string; pct: number }

/**
 * Divide one allocation across successors, or refuse.
 *
 * Throws rather than silently normalising: a split that does not add up is an
 * operator mistake, and quietly rounding it would hand somebody a project at a
 * percentage nobody chose. An EMPTY list is legal and means "leave this
 * unassigned", which the preview states in words.
 */
export function splitAllocation(total: number, shares: readonly Share[]): Share[] {
  if (shares.length === 0) return []

  const seen = new Set<string>()
  for (const share of shares) {
    if (seen.has(share.userId)) {
      throw new Error(`Successor ${share.userId} appears twice in the same split`)
    }
    seen.add(share.userId)
    if (share.pct <= 0) {
      throw new Error(`A share of ${share.pct}% is not a share — remove the successor instead`)
    }
  }

  const sum = shares.reduce((acc, s) => acc + s.pct, 0)
  if (sum !== total) {
    throw new Error(`Shares add up to ${sum}% but the allocation is ${total}%`)
  }
  return shares.map((s) => ({ ...s }))
}
