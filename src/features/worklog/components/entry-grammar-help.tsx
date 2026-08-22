import { describeGrammar } from '@/features/worklog/entry-language'
import type { EntryCategory } from '@/features/worklog/entries'

/**
 * "What it understands" — the parser's vocabulary, written out once.
 *
 * IT WAS WRITTEN OUT TWICE. The one-line logger and the hours card each had
 * their own copy of this block, and the day panel renders both — so anybody
 * logging a day met the same eight lines of grammar twice on one screen, a few
 * hundred pixels apart. Two copies of a legend is also two places for it to go
 * stale in different directions, which had already started: one title-cased
 * the raw category value and the other used a label map, so the same category
 * appeared under two different words.
 *
 * Now one component, and the day panel shows it ONCE. That is the same rule
 * the panel already applies to the AI draft button — "two triggers doing
 * overlapping work is what this panel removes" — which had simply never been
 * applied to the help text beside them.
 *
 * The content still comes from `describeGrammar()`, which reads the arrays the
 * parser actually runs on: a word added to the grammar is documented for free,
 * and one removed cannot linger here promising something that no longer works.
 */

/**
 * The category names as a person says them, rather than as the enum spells
 * them. Lives here because both callers need it and only one of them had it.
 */
export const CATEGORY_LABEL: Record<EntryCategory, string> = {
  task: 'Task',
  meeting: 'Meeting',
  review: 'Review',
  support: 'Support',
  admin: 'Admin',
  learning: 'Learning',
  other: 'Other',
}

export function EntryGrammarHelp({
  /**
   * Whether to document the `%` score.
   *
   * Only the one-line box takes one — the hours input logs time and nothing
   * else, and telling somebody there that `50%` scores their day would
   * document something that field cannot do.
   */
  showScore = false,
}: {
  showScore?: boolean
}) {
  const grammar = describeGrammar()

  return (
    <details>
      <summary className="w-fit cursor-pointer text-2xs text-muted-foreground hover:text-foreground">
        What it understands
      </summary>
      <div className="mt-1.5 flex flex-col gap-1 rounded-xl border border-border/50 bg-background/40 p-2.5">
        {showScore ? (
          <p className="text-2xs text-muted-foreground">
            <span className="font-medium text-foreground">Score:</span>{' '}
            <span className="font-mono">25% · 50% · 80% · 100%</span> — the sign is what makes it
            a score rather than hours.
          </p>
        ) : null}
        <p className="text-2xs text-muted-foreground">
          <span className="font-medium text-foreground">Time:</span>{' '}
          <span className="font-mono">{grammar.durations.join('  ·  ')}</span>
        </p>
        {grammar.kinds.map((kind) => (
          <p key={kind.label} className="text-2xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {CATEGORY_LABEL[kind.label as EntryCategory] ?? kind.label}:
            </span>{' '}
            <span className="font-mono">{kind.words}</span>
          </p>
        ))}
        <p className="text-2xs text-muted-foreground">
          Naming a project attributes the time to it; naming a task makes it a task entry. The
          first matching word wins, so a &ldquo;review meeting&rdquo; is a meeting.
        </p>
      </div>
    </details>
  )
}
