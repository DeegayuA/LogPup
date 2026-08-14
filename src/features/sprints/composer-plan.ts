import { parseTaskIntent, type IntentPerson } from '@/lib/task-intent'

/** What Enter will actually do — shown to the user before it does it. */
export type ComposerPlan = {
  title: string
  assignee: IntentPerson | null
  /** Everyone selected — more than one means one task per person on Enter. */
  assignees: IntentPerson[]
  /** A name that matched several teammates. Blocks Enter until it's narrowed. */
  ambiguousQuery: string | null
  ambiguousNames: string[]
  /** A name that matched nobody. Still creates, unassigned. */
  unresolvedQuery: string | null
  due: string | null
  dueLabel: string | null
  priority: number | null
  priorityLabel: string | null
  description: string | null
}

/**
 * Reads the draft the same way the ⌘K palette does, then adapts the result to
 * a board column, where an "on <app>" hint is meaningless (this board IS the
 * app) — so those words go back into the title instead of disappearing.
 *
 * Extracted from the composer component so it can be tested: this repo has no
 * component-test harness, and this is the piece with behaviour worth pinning.
 */
export function planFor(raw: string, people: IntentPerson[], today: Date): ComposerPlan | null {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return null

  // The floor the parser refuses to read (too short, or nothing but a date):
  // capture it verbatim rather than refusing the task.
  const verbatim: ComposerPlan = {
    title: text,
    assignee: null,
    assignees: [],
    ambiguousQuery: null,
    ambiguousNames: [],
    unresolvedQuery: null,
    due: null,
    dueLabel: null,
    priority: null,
    priorityLabel: null,
    description: null,
  }

  const intent = parseTaskIntent(text, people, today)
  if (!intent) return verbatim

  const title = intent.appQuery ? `${intent.title} on ${intent.appQuery}` : intent.title

  /*
   * Everything the parse understood BESIDE the name, shared by all three
   * outcomes on purpose.
   *
   * Whether a name resolved to one person, to several, or to nobody says
   * nothing about the date, priority or description written beside it. The
   * unresolved branch used to return the give-up object instead — raw title,
   * nulls throughout — so a single unknown teammate silently threw away the
   * due date the same phrase had just been understood to contain. Hoisting
   * the carried fields makes that a structural guarantee rather than three
   * lists that have to be kept in step by hand.
   */
  const parsed: ComposerPlan = {
    ...verbatim,
    title,
    due: intent.due,
    dueLabel: intent.dueLabel,
    priority: intent.priority,
    priorityLabel: intent.priorityLabel,
    description: intent.description,
  }

  if (intent.ambiguous.length > 1) {
    return {
      ...parsed,
      ambiguousQuery: intent.assigneeQuery,
      ambiguousNames: intent.ambiguous.map((p) => p.name),
    }
  }
  // The name is dropped from the title rather than kept: the preview states it
  // in red before Enter, and the ⌘K palette resolves the same case the same
  // way. A task called "@nobody fix the login" is a worse record than one
  // called "fix the login" that was announced as unassigned.
  if (intent.assigneeQuery) return { ...parsed, unresolvedQuery: intent.assigneeQuery }

  return { ...parsed, assignee: intent.assignee, assignees: intent.assignees }
}
