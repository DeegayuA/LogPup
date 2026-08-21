import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { SuggestionDecisionButtons } from '@/features/meeting-load/components/suggestion-decision-buttons'
import type { ObservedChange } from '@/features/meeting-load/observed-change'
import type { Suggestion } from '@/features/meeting-load/suggest'

/**
 * The full queue, and the ledger that holds it accountable.
 *
 * THE ONE PLACE R5 TRIM-INVITE MAY RENDER, names and all — everywhere else it
 * cannot even fire, because the org-facing reads never supply the names it
 * needs.
 *
 * ACCEPTANCE IS GROUPED BY RULE, NEVER BY PERSON, and nothing on this card may
 * change that. It is tuning telemetry: if one rule is dismissed every single
 * time, that rule is wrong and this is how anybody finds out. The same numbers
 * cut by organizer would be a performance review, and with two or three
 * organizers it would be attributable to individuals immediately.
 *
 * Three things v1 deliberately does NOT show, and must not quietly regain: a
 * named pending-responder list, a per-person collision list, and per-organizer
 * density.
 */
export function MeetingLoadAdminCard({
  suggestions,
  dismissed,
  observed,
  acceptance,
}: {
  suggestions: Suggestion[]
  dismissed: { id: string; kind: string; targetKey: string; decidedAt: Date }[]
  observed: { decisionId: string; kind: string; change: ObservedChange }[]
  acceptance: { kind: string; accepted: number; dismissed: number; rate: number }[]
}) {
  return (
    <Card className="border-border/70 bg-card/60 shadow-xs backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">Meeting load</CardTitle>
        <CardDescription>
          Every open suggestion across the workspace, what happened after the accepted ones, and
          how often each rule is worth listening to.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">Open</h3>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to ask about right now.</p>
          ) : (
            suggestions.map((suggestion) => (
              <div key={suggestion.targetKey} className="flex flex-col gap-2">
                <p className="text-sm">{suggestion.copy}</p>
                <SuggestionDecisionButtons
                  kind={suggestion.kind}
                  targetKey={suggestion.targetKey}
                  evidence={suggestion.evidence}
                />
              </div>
            ))
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Dismissed</h3>
          {dismissed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing dismissed yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {dismissed.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{row.kind}</span>
                  <span className="font-mono text-2xs text-muted-foreground">{row.targetKey}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">What happened after</h3>
          {observed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing accepted yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {observed.map((row) => (
                <li key={row.decisionId} className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{row.kind}</span>
                  <span>
                    {/* Reported as measured, increase included. A ledger that
                        could only show improvement would not be a ledger. */}
                    {row.change.status === 'no-data-yet'
                      ? 'has not met since'
                      : `${row.change.deltaHours >= 0 ? '+' : ''}${row.change.deltaHours.toFixed(1)}h a week`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            Which rules are worth listening to
          </h3>
          {acceptance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {acceptance.map((row) => (
                <li key={row.kind} className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{row.kind}</span>
                  <span className="tabular-nums">
                    {row.accepted} accepted, {row.dismissed} dismissed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
