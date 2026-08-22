import { cache } from 'react'
import { and, eq, gte, lt } from 'drizzle-orm'

import { db } from '@/db'
import { aiUsageEvents, users } from '@/db/schema'
import { estimateCostUsd } from '@/features/gemini/pricing'
import { budgetState, DEFAULT_AI_BUDGET_USD, type Budget } from '@/features/gemini/budget'

/**
 * What this person has spent on AI this calendar month, against their cap.
 *
 * PRICED PER EVENT, NOT PER MONTH. Each row is costed against the rate in force
 * when it was made, through the same `estimateCostUsd` every other figure in
 * the product uses — so a price change mid-month does not retroactively repice
 * the first three weeks. It is the same rule projectCost keeps for hours.
 *
 * A ROW WITH NO PUBLISHED RATE IS COUNTED, NOT SKIPPED. `priceForModel` returns
 * null for a model `pricing.ts` has never heard of, and model discovery now
 * offers models that did not exist when that table was written. Skipping them
 * would make the cap leak on exactly the models nobody has checked. They go
 * into `unpricedCalls`, which every message carries.
 *
 * `cache()` because the enforcement path and the settings surface both ask in
 * the same request, and the answer cannot change between them.
 */
export const getAiBudget = cache(readAiBudget)

/**
 * The same read, UNCACHED.
 *
 * The threshold check runs after a call's ledger row is written, IN THE SAME
 * REQUEST, and needs the number including that row. `cache()` memoises per
 * request, so the cached door would hand it the value from before the call and
 * the warning would always be one call late — or never fire at all on the call
 * that crossed the line.
 *
 * It happens to work through the cached door too, because the timestamps
 * differ and `cache()` keys on arguments. That is accidental, and accidental
 * correctness is the kind that a later "let's pass the same `now` through"
 * quietly deletes.
 */
export async function readAiBudget(
  userId: string,
  now: Date = new Date(),
): Promise<Budget> {
  // The calendar month in UTC. Deliberately NOT Asia/Colombo: this is billed
  // against Google's month, not the studio's working week, and the two
  // disagreeing would put a call on the wrong side of a reset.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  const [userRow, events] = await Promise.all([
    db.select({ budget: users.aiBudgetUsd }).from(users).where(eq(users.id, userId)).limit(1),
    db
      .select({
        model: aiUsageEvents.model,
        inputTokens: aiUsageEvents.inputTokens,
        outputTokens: aiUsageEvents.outputTokens,
        createdAt: aiUsageEvents.createdAt,
      })
      .from(aiUsageEvents)
      // The CALLER's spend, not the key owner's. A call made on a teammate's
      // shared key is still this person's decision to spend, and billing it to
      // the key's owner would cap whoever was generous rather than whoever
      // spent.
      .where(
        and(
          eq(aiUsageEvents.userId, userId),
          gte(aiUsageEvents.createdAt, monthStart),
          lt(aiUsageEvents.createdAt, nextMonth),
        ),
      ),
  ])

  let spentUsd = 0
  let unpricedCalls = 0
  for (const event of events) {
    const cost = estimateCostUsd({
      model: event.model,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      at: event.createdAt,
    })
    if (cost === null) unpricedCalls += 1
    else spentUsd += cost
  }

  // numeric comes back as a string from the driver, which is the point of
  // storing it as one. Number() at the edge, once.
  const raw = userRow[0]?.budget
  const budgetUsd = raw === undefined || raw === null ? DEFAULT_AI_BUDGET_USD : Number(raw)

  return budgetState({ spentUsd, budgetUsd, unpricedCalls })
}
