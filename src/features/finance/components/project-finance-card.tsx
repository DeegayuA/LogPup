import { Landmark } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { projectCost, projectMargin, projectWorth } from '@/features/finance/queries'
import { MIN_COST_CONTRIBUTORS, type CostBreakdown } from '@/features/finance/cost'

/**
 * What a project cost, what it is worth, and the gap — the first surface this
 * module has ever had.
 *
 * `src/features/finance` shipped complete and unreachable: projectCost,
 * projectWorth, projectMargin, effortMix, portfolioCost and five rate-setting
 * actions, every one of them tested, and not one import anywhere in the app.
 * This card is the consumer.
 *
 * IT RENDERS WHAT THE QUERIES SAY AND NOTHING MORE. Every honest-uncertainty
 * distinction those functions took trouble to preserve is preserved here too,
 * because a UI is exactly where they get flattened:
 *
 *  - `state: 'denied'` renders NOTHING AT ALL. Not an empty card, not a
 *    padlock — somebody without `finance.view` should not learn that a money
 *    figure exists for this project, and a greyed-out card tells them.
 *  - `state: 'suppressed'` says so in words. Cost is withheld below
 *    MIN_COST_CONTRIBUTORS because a project with one contributor publishes
 *    that person's rate, and their salary is not a project metric.
 *  - `fullyPriced === false` means the amount is NOT a smaller cost, it is a
 *    different claim. The unpriced hours are printed beside it every time.
 *  - `amount === null` and `amount === 0` are different sentences: nothing was
 *    priceable, versus nothing was spent.
 *  - Contract value and subscription are shown SEPARATELY and never added. A
 *    fixed-price build and a monthly retainer are different kinds of money.
 */

/**
 * The window. A quarter rather than all-time, because "what has this cost"
 * asked of a three-year project is a number nobody can act on — and because
 * rates resolve per day, so a long window silently spans raises.
 */
const WINDOW_DAYS = 90

function money(amount: number, currency: string | null): string {
  const value = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${currency} ${value}` : value
}

function hours(minutes: number): string {
  // Minutes are the storage unit; division by 60 happens here, at the display
  // edge, exactly as worklog_entries' own comment requires.
  return (minutes / 60).toLocaleString('en-US', { maximumFractionDigits: 1 })
}

/** One figure with its label, in the mono/tabular treatment data values get. */
function Figure({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-2xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-base font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {hint ? <span className="text-2xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

/**
 * The cost line, with everything `CostBreakdown` insists a caller checks
 * before printing `amount`.
 */
function CostFigure({ cost }: { cost: CostBreakdown }) {
  if (cost.mixedCurrency) {
    return <Figure label="Cost" value="—" hint="Two currencies here, which this does not add up." />
  }
  if (cost.amount === null) {
    return (
      <Figure
        label="Cost"
        value="Not priced"
        hint={`${hours(cost.unpricedMinutes)}h logged with no rate in force`}
      />
    )
  }
  return (
    <Figure
      label="Cost"
      value={money(cost.amount, cost.currency)}
      hint={
        cost.fullyPriced
          ? `${hours(cost.pricedMinutes)}h`
          : // Never silently. A third of the hours missing makes this a
            // different claim, not a smaller number.
            `${hours(cost.pricedMinutes)}h priced · ${hours(cost.unpricedMinutes)}h with no rate`
      }
    />
  )
}

export async function ProjectFinanceCard({
  appId,
  todayIso,
}: {
  appId: string
  /** Asia/Colombo today, resolved once by the page. Never read from a clock here. */
  todayIso: string
}) {
  const from = shiftDays(todayIso, -WINDOW_DAYS)
  // `to` is EXCLUSIVE in every one of these queries, so today itself is
  // included by passing tomorrow.
  const to = shiftDays(todayIso, 1)

  const [cost, worth, margin] = await Promise.all([
    projectCost(appId, from, to),
    projectWorth(appId, todayIso),
    projectMargin(appId, from, to),
  ])

  // Denied renders nothing whatsoever — see the header. Somebody who may not
  // see money must not learn that money exists here.
  if (cost.state === 'denied') return null

  const hasWorth =
    worth.state === 'ok' && (worth.contractValue !== null || worth.subscription !== null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark aria-hidden className="size-4 text-muted-foreground" />
          Cost and worth
        </CardTitle>
        <CardDescription>
          The last {WINDOW_DAYS} days. Each hour priced at the rate in force on the day it was
          logged, never today&rsquo;s.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {cost.state === 'suppressed' ? (
          <p className="text-sm text-muted-foreground">
            Withheld —{' '}
            {cost.contributorCount === 1
              ? 'one person has'
              : `${cost.contributorCount} people have`}{' '}
            logged against this project, and a cost over fewer than {MIN_COST_CONTRIBUTORS}{' '}
            publishes what they are paid. Their salary is not a project metric.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <CostFigure cost={cost.cost} />

            {worth.state === 'ok' && worth.contractValue !== null ? (
              <Figure label="Contract" value={money(worth.contractValue, worth.currency)} />
            ) : null}

            {/* Beside the contract, never summed with it — a retainer and a
                fixed-price build are different kinds of money. */}
            {worth.state === 'ok' && worth.subscription !== null ? (
              <Figure
                label="Subscription"
                // Its OWN currency, not the worth row's: SubscriptionAccrual
                // carries one and it is the currency the months were accrued
                // in. Two fields named currency in one component is exactly
                // where the wrong one gets printed.
                value={money(worth.subscription.amount, worth.subscription.currency)}
                hint={`${worth.subscription.months} ${worth.subscription.months === 1 ? 'month' : 'months'} accrued`}
              />
            ) : null}

            {margin.state === 'ok' && margin.againstContract !== null ? (
              <Figure
                label="Margin"
                value={money(margin.againstContract, margin.cost.currency)}
                hint={
                  // The flag CostBreakdown exists to make unmissable: a margin
                  // computed from a partial cost is a partial margin, and
                  // saying so is the difference between a figure and a guess.
                  margin.cost.fullyPriced
                    ? 'against contract'
                    : 'against contract, from a partial cost'
                }
              />
            ) : null}

            {margin.state === 'ok' && margin.againstSubscription !== null ? (
              <Figure
                label="Margin"
                value={money(margin.againstSubscription, margin.cost.currency)}
                hint="against subscription earned in this window"
              />
            ) : null}
          </div>
        )}

        {!hasWorth && cost.state !== 'suppressed' ? (
          <p className="text-2xs text-muted-foreground">
            No contract value or subscription is recorded for this project, so there is nothing to
            take the cost away from.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * `YYYY-MM-DD` plus or minus whole days.
 *
 * UTC construction throughout and back out as a string — the date never
 * becomes a local instant, which is the bug `tasks.due_date` documents:
 * `new Date('2026-08-12')` is midnight UTC, still the 11th west of Greenwich.
 */
function shiftDays(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, date + delta))
  return shifted.toISOString().slice(0, 10)
}
