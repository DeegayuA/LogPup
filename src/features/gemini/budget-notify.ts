import { db } from '@/db'
import { eq } from 'drizzle-orm'

import { users } from '@/db/schema'
import { createNotifications } from '@/features/notifications/notify'
import { readAiBudget } from '@/features/gemini/budget-queries'
import { budgetLadderStep, budgetMonth, warnBudgetMessage, overBudgetMessage } from '@/features/gemini/budget'
import { isoDayOf } from '@/features/people/iso-day'

/**
 * Tell somebody their AI budget is nearly, or entirely, gone.
 *
 * FIRED FROM THE LEDGER WRITE, not from the enforcement check. The check runs
 * on every call and is latency-sensitive; this runs after a call has already
 * completed and is where the number actually moved. It also means the 100%
 * message is sent once, by the call that crossed the line — rather than on
 * every refusal afterwards, which would notify somebody repeatedly about a
 * thing they can do nothing about.
 *
 * ONCE PER RUNG PER MONTH, and that is the ladder dedupe rather than anything
 * here: `armedOn` is the month, so August's 90% warning and September's are
 * different rows, while the fortieth call of August that is still at 91% writes
 * nothing. The rung is derived from the state, so a person who crosses 90% and
 * then 100% gets exactly two messages.
 *
 * BEST EFFORT. Swallows everything: a warning that failed to send must never be
 * what turns a completed AI call into an error the caller sees.
 */
export async function notifyBudgetThreshold(userId: string, now: Date = new Date()): Promise<void> {
  try {
    // UNCACHED: this runs after the ledger row for the call that may have
    // just crossed the line, and must see it.
    const budget = await readAiBudget(userId, now)
    const step = budgetLadderStep(budget)
    if (step === null) return

    const [person] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!person) return

    await createNotifications([
      {
        userId,
        type: 'system',
        kind: step === '100' ? 'ai.budget.spent' : 'ai.budget.low',
        title: step === '100' ? overBudgetMessage(budget) : warnBudgetMessage(budget),
        link: '/settings',
        dedupe: {
          mode: 'ladder',
          ladder: 'ai-budget',
          entityId: userId,
          step,
          // The month IS the arming fact: a new month re-arms both rungs, and
          // nothing else does.
          armedOn: budgetMonth(isoDayOf(now)),
        },
      },
    ], now)
  } catch (error) {
    // A warning that failed to send must not turn a completed call into an
    // error the caller sees.
    console.error('[ai-budget] threshold notification failed (ignored):', error)
  }
}
