import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { SuggestionDecisionButtons } from '@/features/meeting-load/components/suggestion-decision-buttons'
import type { Suggestion } from '@/features/meeting-load/suggest'

/**
 * The organizer-private queue: your own series, and only yours.
 *
 * SUGGESTIONS ARE NOT AN ORG SURFACE. A named series carrying a negative
 * verdict, visible to everyone, is a public judgement about whoever runs it —
 * so these render to the organizer and to admins, and the org at large sees
 * only an aggregate count on the dashboard.
 *
 * Rendered only when there is something to say. An empty "Your series" card
 * sitting on the meetings page every day would be a standing reminder that the
 * app is watching.
 */
export function YourSeriesCard({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) return null

  return (
    <Card className="border-border/70 bg-card/60 shadow-xs backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">Your series</CardTitle>
        <CardDescription>
          Questions about meetings you run. Answering one records what you decided — it never
          changes the meeting.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {suggestions.map((suggestion) => (
          <div key={suggestion.targetKey} className="flex flex-col gap-2 border-t border-border/60 pt-3 first:border-0 first:pt-0">
            <p className="text-sm">{suggestion.copy}</p>
            {/* The evidence line, so the question can be checked rather than
                taken on trust. */}
            <p className="text-xs text-muted-foreground">
              {evidenceLine(suggestion)}
            </p>
            <SuggestionDecisionButtons
              kind={suggestion.kind}
              targetKey={suggestion.targetKey}
              evidence={suggestion.evidence}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** The numbers behind the question, in words. Built from the evidence snapshot
 *  itself so it can never disagree with what a decision would record. */
function evidenceLine(suggestion: Suggestion): string {
  const parts: string[] = []
  const evidence = suggestion.evidence
  const num = (key: string) => (typeof evidence[key] === 'number' ? evidence[key] as number : null)

  const coverage = num('coverage')
  if (coverage !== null) parts.push(`${Math.round(coverage * 100)}% recorded`)
  const turns = num('medianVoiceTurns')
  if (turns !== null) parts.push(`${turns} turns a time`)
  const speakers = num('medianMappedSpeakers')
  if (speakers !== null) parts.push(`${speakers} people talking`)
  const hours = num('invitedHoursPerWeek')
  if (hours !== null) parts.push(`${Math.round(hours * 10) / 10}h a week invited`)
  const proposed = num('proposedMinutes')
  if (proposed !== null) parts.push(`${proposed} minutes proposed`)
  const jaccard = num('jaccard')
  if (jaccard !== null) parts.push(`${Math.round(jaccard * 100)}% of the invite list shared`)

  return parts.length === 0 ? 'Based on this series’ own recent occurrences.' : parts.join(' · ')
}
