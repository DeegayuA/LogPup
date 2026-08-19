// Org-wide "which AI features are people using" panel for /admin. The whole
// point is the rows nobody touched — summarizeAdoption always returns one
// row per registered AI_FEATURES entry, including zero-usage ones, and this
// card must render every one of them. Filtering down to only what appears
// in the ledger would silently hide exactly the features the product owner
// asked about.
//
// Blocked calls get their own columns rather than being hidden or counted as
// use: "6 tried, 0 succeeded" is the most actionable row this panel can show,
// and it is the exact row that reads as "used by most" if failures are folded
// into the call count.

import { ChartNoAxesColumn } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AI_FEATURES } from '@/features/gemini/ai-features'
import { aggregateAdoption, perUserFeatureUsage } from '@/features/gemini/queries'
import { summarizeAdoption } from '@/features/gemini/usage-summary'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

// The badge WORD carries the state (WCAG 1.4.1) — colour only reinforces it.
const VERDICT_BADGE = {
  strong: { word: 'Used by most', variant: 'default' as const },
  partial: { word: 'A few people', variant: 'secondary' as const },
  unused: { word: 'Nobody yet', variant: 'destructive' as const },
}

type AiAdoptionCardProps = {
  /**
   * Denominator for the adoption-% column, computed by the caller from
   * whatever the page's own Users table already treats as "active" (see
   * admin/page.tsx). Only the percentage column depends on this number —
   * per-feature user counts and the unused list are absolute and unaffected.
   */
  activeUserCount: number
}

export async function AiAdoptionCard({ activeUserCount }: AiAdoptionCardProps) {
  const now = new Date()
  const since = new Date(now.getTime() - WINDOW_MS)
  const [adoptionRows, perUser] = await Promise.all([
    aggregateAdoption(since),
    perUserFeatureUsage(since),
  ])
  const adoption = summarizeAdoption(adoptionRows, activeUserCount).sort(
    (a, b) => b.users - a.users,
  )
  // Nobody has succeeded, yet people keep trying: broken or unconfigured,
  // not unwanted — a different fix from "nobody knows it exists", so these are
  // called out on their own and kept OUT of the untouched list below, which
  // would otherwise call a feature people are actively reaching for untouched.
  const failingForEveryone = adoption.filter((a) => a.users === 0 && a.failedUsers > 0)
  const unused = adoption.filter((a) => a.verdict === 'unused' && a.failedUsers === 0)

  const slugToLabel = new Map(
    AI_FEATURES.flatMap((f) => f.slugs.map((s) => [s as string, f.label] as const)),
  )
  const byPerson = new Map<string, { name: string; features: Set<string>; calls: number }>()
  for (const row of perUser) {
    const label = slugToLabel.get(row.feature)
    if (!label) continue
    const entry = byPerson.get(row.userId) ?? { name: row.userName, features: new Set(), calls: 0 }
    entry.features.add(label)
    entry.calls += row.calls
    byPerson.set(row.userId, entry)
  }
  const people = [...byPerson.values()].sort((a, b) => b.calls - a.calls)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <ChartNoAxesColumn className="size-4" aria-hidden /> AI feature adoption
        </CardTitle>
        <CardDescription>
          Who is actually using which AI feature, last 30 days, across {activeUserCount} active
          {activeUserCount === 1 ? ' person' : ' people'}. Counts are calls, not sessions, and only
          calls that ran — requests blocked before reaching Google are counted as failed, never as
          use. A feature nobody has touched is the one worth redesigning.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-normal">Feature</th>
                <th className="py-2 font-normal">People</th>
                <th className="py-2 font-normal">Share</th>
                <th className="py-2 font-normal">Calls</th>
                <th className="py-2 font-normal">Failed</th>
                <th className="py-2 font-normal">Last used</th>
                <th className="py-2 font-normal">State</th>
              </tr>
            </thead>
            <tbody>
              {adoption.map((row) => (
                <tr key={row.featureId} className="border-b last:border-0">
                  <td className="py-2">{row.label}</td>
                  <td className="py-2 font-mono tabular-nums">{row.users}</td>
                  <td className="py-2 font-mono tabular-nums">{row.adoptionPct}%</td>
                  <td className="py-2 font-mono tabular-nums">{row.calls}</td>
                  <td className="py-2 font-mono tabular-nums">
                    {row.failedCalls > 0 ? row.failedCalls : '—'}
                  </td>
                  <td className="py-2 font-mono text-xs">
                    {row.lastUsedAt ? row.lastUsedAt.toISOString().slice(0, 10) : '—'}
                  </td>
                  <td className="py-2">
                    <Badge variant={VERDICT_BADGE[row.verdict].variant}>
                      {VERDICT_BADGE[row.verdict].word}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {failingForEveryone.length > 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm">
            <span className="font-medium">Tried but never worked:</span>{' '}
            {failingForEveryone
              .map(
                (f) =>
                  `${f.label} (${f.failedUsers} ${f.failedUsers === 1 ? 'person' : 'people'}, ${f.failedCalls} attempt${f.failedCalls === 1 ? '' : 's'}, 0 succeeded)`,
              )
              .join(', ')}
            . People want these — something is stopping them, most often a missing or exhausted
            Gemini key.
          </p>
        ) : null}

        {unused.length > 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm">
            <span className="font-medium">Untouched in 30 days:</span>{' '}
            {unused.map((u) => u.label).join(', ')}. Either nobody knows these exist, or they
            do not fit the work — worth asking before building more on top of them.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Per person</h3>
          {people.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No AI calls recorded yet in this window.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {people.map((p) => (
                <li key={p.name} className="flex flex-wrap items-baseline gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="font-mono tabular-nums text-xs text-muted-foreground">
                    {p.calls} calls
                  </span>
                  <span className="w-full text-xs text-muted-foreground">
                    {[...p.features].join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
