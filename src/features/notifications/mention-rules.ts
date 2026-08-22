/**
 * Whether a mention reaches the person it names, and what to tell the author
 * when it does not.
 *
 * PURE — booleans in, a reason out. No db, no clock. The facts are gathered by
 * `recordMentions`; the decision lives here so every branch is testable by
 * value, including the ones that are awkward to arrange against a database.
 *
 * THE RULE THAT SHAPES THIS FILE: a mention that cannot be delivered is
 * RECORDED AND REPORTED, never dropped. The row is written either way, with a
 * reason, and the author is told in a sentence naming the person. Without that
 * half, somebody types a name, sees no error, and spends six months believing
 * they told a colleague something.
 */

/**
 * Why a mention was not delivered. Null is delivery.
 *
 * `assignment_supersedes` is not a failure: when one action both mentions
 * somebody and offers them the task, exactly one bell row is created and it is
 * the assignment one. The mention is still recorded so "mentions of me" stays
 * complete, and the author needs no advisory because the person WAS reached.
 */
export const SUPPRESSED_REASONS = [
  'no_access',
  'inactive',
  'self',
  'assignment_supersedes',
] as const

export type SuppressedReason = (typeof SUPPRESSED_REASONS)[number]

/** What is known about one named person at the moment of the mention. */
export type MentionFacts = {
  /** The author named themselves. */
  isSelf: boolean
  /** users.active — a deactivated seat reads nothing. */
  isActive: boolean
  /** users.status === 'approved'. A pending signup is not yet a colleague. */
  isApproved: boolean
  /**
   * Whether they can open the thing they were named in.
   *
   * TRUE when the source belongs to no project — a worklog note is nobody's
   * project — because "no project" is not "no access", and treating it as one
   * would suppress every mention written outside a project.
   */
  hasAccess: boolean
  /** This same action is also offering them the task. */
  supersededByAssignment: boolean
}

/**
 * The reason this mention will not produce a bell row, or null if it will.
 *
 * ORDER IS THE CONTRACT, not an implementation detail. Self first, because
 * naming yourself is never worth reporting to yourself. Assignment next, so an
 * offer is described as an offer rather than as an access failure. Then the
 * facts about the person, most fundamental first: a deactivated seat is not a
 * scope problem, and reporting it as one sends the author to an admin to fix
 * the wrong thing.
 */
export function classifyMention(facts: MentionFacts): SuppressedReason | null {
  if (facts.isSelf) return 'self'
  if (facts.supersededByAssignment) return 'assignment_supersedes'
  if (!facts.isActive || !facts.isApproved) return 'inactive'
  if (!facts.hasAccess) return 'no_access'
  return null
}

/** Whether the author should be told about this outcome at all. */
export function worthReporting(reason: SuppressedReason | null): boolean {
  // Delivered needs no sentence. Naming yourself is not news. An assignment
  // reached them by another door, so saying "not notified" would be false.
  return reason === 'no_access' || reason === 'inactive'
}

export type SuppressedMention = { name: string; reason: SuppressedReason }

/**
 * One sentence for the author, or null when there is nothing to say.
 *
 * Names the person and the reason, because "some mentions were not delivered"
 * is a message nobody can act on. Non-fatal by construction: the caller shows
 * it beside a save that succeeded.
 *
 * `sourceLabel` is the thing they cannot see — naming it is what turns the
 * advisory into an action ("give Nuwan access to Atlas") rather than a shrug.
 */
export function mentionAdvisory(
  suppressed: readonly SuppressedMention[],
  sourceLabel: string | null,
): string | null {
  const reportable = suppressed.filter((entry) => worthReporting(entry.reason))
  if (reportable.length === 0) return null

  const noAccess = reportable.filter((entry) => entry.reason === 'no_access')
  const inactive = reportable.filter((entry) => entry.reason === 'inactive')

  const parts: string[] = []
  if (noAccess.length > 0) {
    const who = nameList(noAccess.map((entry) => entry.name))
    parts.push(
      sourceLabel ? `${who} can’t see ${sourceLabel}` : `${who} can’t see what you named them in`,
    )
  }
  if (inactive.length > 0) {
    const who = nameList(inactive.map((entry) => entry.name))
    parts.push(`${who} ${inactive.length === 1 ? 'has' : 'have'} no active seat`)
  }

  // "Recorded, not notified" is the load-bearing half: it says the mention was
  // kept, so nobody re-types it, and says it did not arrive, so nobody assumes
  // it did.
  return `${parts.join('; ')} — mention recorded, not notified.`
}

/** "Ama", "Ama and Nuwan", "Ama, Nuwan and Sana". */
function nameList(names: readonly string[]): string {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
