import type { Briefing } from '@/features/intel/actions'
import type { Signal, SignalInput, SignalKind } from '@/features/intel/signals'

/**
 * The briefing a person reads when there is no AI in the loop — no Gemini key,
 * the feature switched off in Settings, or a call that just failed.
 *
 * It is not a placeholder. This is the majority path for anyone who never adds
 * a key, so it has to read like a colleague wrote it: plurals that agree, zero
 * clauses dropped rather than printed as "0 tasks", and — the hard one — a
 * calm, true sentence when nothing is wrong, instead of manufacturing urgency
 * so the panel looks busy. A briefing that cries wolf on a quiet Tuesday is
 * worse than no briefing, because the next one gets skimmed.
 *
 * Every number it states comes from the same `SignalInput` the detectors read,
 * and every ordering decision comes from the already-ranked `signals`, so the
 * paragraph can never contradict the list rendered under it.
 */

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** "a", "a and b", "a, b and c" — the way a person writes a list. */
function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * The entity half of a signal id.
 *
 * The id shape `<kind>:<entity>` is fixed by the Signal contract, not by the
 * detector's internals, so reading the tail is reading a published format.
 * It is what lets a priority say "Move work off Nuwan" rather than "Someone is
 * over capacity" — the three lines a reader acts on are the ones that most
 * need to name a target.
 */
function entityKey(id: string): string {
  return id.slice(id.indexOf(':') + 1)
}

/** One imperative line per signal, specific enough to act on without scrolling. */
function priorityFor(signal: Signal, input: SignalInput): string {
  switch (signal.kind) {
    case 'task.overdue':
      return `Clear ${plural(signal.count, 'overdue task', 'overdue tasks')}.`
    case 'followup.stale':
      return `Answer ${plural(signal.count, 'follow-up', 'follow-ups')} you owe.`
    case 'capacity.over': {
      const person = input.capacities.find((c) => c.userId === entityKey(signal.id))
      return person
        ? `Move work off ${person.name}, now at ${signal.count}%.`
        : `${signal.title}.`
    }
    case 'capacity.near': {
      const person = input.capacities.find((c) => c.userId === entityKey(signal.id))
      return person
        ? `Give ${person.name} nothing new — already at ${signal.count}%.`
        : `${signal.title}.`
    }
    case 'sprint.at-risk': {
      const sprint = input.sprints.find((s) => s.id === entityKey(signal.id))
      return sprint
        ? `Re-scope ${sprint.name} — ${plural(sprint.openTasks, 'task', 'tasks')} still open.`
        : `${signal.title}.`
    }
    case 'worklog.gap':
      return `Fill in ${plural(signal.count, 'missing work log day', 'missing work log days')}.`
    case 'meeting.unwritten':
      return `Write up ${plural(signal.count, 'meeting', 'meetings')} with no notes.`
    case 'app.quiet': {
      const app = input.quietApps.find((a) => a.slug === entityKey(signal.id))
      return app
        ? `Check in on ${app.name} — quiet for ${plural(signal.count, 'day', 'days')}.`
        : `${signal.title}.`
    }
  }
}

/**
 * What the reader personally has on their plate, as noun phrases to follow
 * "You have". A clause is only built when its number is above zero, so the
 * sentence shortens as the day clears instead of listing a row of noughts.
 */
function ownClauses(input: SignalInput): string[] {
  const parts: string[] = []
  if (input.tasks.overdue > 0) {
    parts.push(plural(input.tasks.overdue, 'overdue task', 'overdue tasks'))
  }
  if (input.tasks.dueSoon > 0) {
    parts.push(`${plural(input.tasks.dueSoon, 'task', 'tasks')} due this week`)
  }
  if (input.followupsOwed > 0) {
    parts.push(`${plural(input.followupsOwed, 'follow-up', 'follow-ups')} to answer`)
  }
  if (input.worklogGapDays.length > 0) {
    parts.push(`${plural(input.worklogGapDays.length, 'working day', 'working days')} unlogged`)
  }
  if (input.unwrittenMeetings.length > 0) {
    parts.push(`${plural(input.unwrittenMeetings.length, 'meeting', 'meetings')} still to write up`)
  }
  return parts
}

/**
 * What is true of the team, as full clauses to follow "Across the team,".
 *
 * Counted off the ranked signals rather than recomputed from the raw input:
 * the working-day arithmetic behind "at risk" and the band behind "over
 * capacity" each live in exactly one place, and this paragraph is not allowed
 * a second opinion about either. It also makes the invariant structural — the
 * number in the sentence is the number of rows rendered underneath it.
 */
function teamClauses(signals: Signal[]): string[] {
  const count = (kind: SignalKind) => signals.filter((signal) => signal.kind === kind).length
  const parts: string[] = []

  const over = count('capacity.over')
  if (over > 0) parts.push(`${plural(over, 'person is', 'people are')} over capacity`)

  const near = count('capacity.near')
  if (near > 0) parts.push(`${plural(near, 'person is', 'people are')} near capacity`)

  const atRisk = count('sprint.at-risk')
  if (atRisk > 0) parts.push(`${plural(atRisk, 'sprint is', 'sprints are')} at risk`)

  const quiet = count('app.quiet')
  if (quiet > 0) parts.push(`${plural(quiet, 'app has', 'apps have')} gone quiet`)

  return parts
}

export function deriveBriefing(
  input: SignalInput,
  signals: Signal[],
): Omit<Briefing, 'model' | 'generatedAtIso'> {
  const alerts = signals.filter((signal) => signal.severity === 'alert').length
  const own = ownClauses(input)
  const team = teamClauses(signals)

  if (signals.length === 0) {
    // Nothing fired, so every claim below is one the detectors just checked:
    // any overdue task, any allocation at or past 80%, any unlogged working
    // day and any meeting without notes each raise a signal. What survives
    // into `own` here can only be work due later this week or follow-ups too
    // fresh to be stale — real load that no row would otherwise mention, and
    // the difference between a calm briefing and one that claims an empty day
    // to somebody with three deadlines on Thursday.
    if (own.length > 0) {
      return {
        headline: 'Nothing is late.',
        body: `You have ${joinClauses(own)} — and that is the whole list: nothing overdue, nobody near capacity, no gaps in your work log.`,
        priorities: [],
        source: 'derived',
      }
    }
    const firstName = input.me.name.trim().split(/\s+/)[0]
    return {
      headline: firstName ? `All clear, ${firstName}.` : 'All clear.',
      body: 'Nothing is overdue, nobody is near capacity, and your work log has no gaps.',
      priorities: [],
      source: 'derived',
    }
  }

  const sentences: string[] = []
  if (own.length > 0) sentences.push(`You have ${joinClauses(own)}.`)
  if (team.length > 0) sentences.push(`Across the team, ${joinClauses(team)}.`)

  return {
    headline:
      alerts > 0
        ? `${plural(alerts, 'thing needs', 'things need')} you today.`
        : `Nothing urgent — ${plural(signals.length, 'thing', 'things')} worth a look.`,
    // A signal always contributes to one of the two sentences, so the fallback
    // is unreachable in practice — it is here so a future kind that belongs to
    // neither list degrades to the top row's own words rather than an empty
    // paragraph.
    body: sentences.length > 0 ? sentences.join(' ') : signals[0].detail,
    priorities: signals.slice(0, 3).map((signal) => priorityFor(signal, input)),
    source: 'derived',
  }
}
