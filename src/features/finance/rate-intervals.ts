/**
 * Row types and pure helpers for rate/value intervals — ZERO DEPENDENCIES,
 * ON PURPOSE. The three cards under `finance/components/` are `'use client'`
 * and import from here, never from `rate-queries.ts`: that file pulls in
 * `@/db`, and a value-import of it from a client component would drag the
 * database driver into the browser bundle. Nothing below reaches outside the
 * language — no `@/db`, no `drizzle-orm`, no `next/*`.
 *
 * See docs/superpowers/specs/2026-09-21-rates-admin-design.md, "Data
 * contracts" — these shapes are pinned there for the other two owners
 * (`rate-queries.ts`, the card components) to build against.
 */

export type RateIntervalRow = {
  id: string
  /** numeric(12,2) as the pg driver returns it: a STRING. Never Number() it for display. */
  hourly: string
  currency: string
  effectiveFrom: string // YYYY-MM-DD
  effectiveTo: string | null // null = open = in force
  setByName: string | null // left join; the setter's account may be gone
}

export type RoleRateRow = RateIntervalRow & { role: string }
export type PersonRateRow = RateIntervalRow & { userId: string; personName: string }

export type ProjectValueRow = {
  appId: string
  appName: string
  slug: string
  contractValue: string | null // null = "not stated", never 0
  subscriptionMonthly: string | null
  subscriptionFrom: string | null
  subscriptionTo: string | null
  currency: string
  setByName: string | null
  updatedAt: Date
}

/**
 * Buckets rows by a HALF-OPEN interval against `today`: in force when
 * `effectiveFrom <= today` AND (`effectiveTo` is null OR `effectiveTo >
 * today`) — the exact rule `cost.ts`'s `rateForPersonOnDay` prices by, so a
 * row this function calls "in force" is the same row that function would
 * price an hour logged today against.
 *
 * A row whose `effectiveFrom` is still in the future is `scheduled`, not
 * history and not in force — v1 has no third zone for it (see the spec's
 * Deferred section); callers fold it into the in-force block with a
 * "from <date>" note.
 */
export function splitByForce<R extends RateIntervalRow>(
  rows: readonly R[],
  today: string,
): { inForce: R[]; scheduled: R[]; history: R[] } {
  const inForce: R[] = []
  const scheduled: R[] = []
  const history: R[] = []
  for (const row of rows) {
    if (row.effectiveFrom > today) {
      scheduled.push(row)
    } else if (row.effectiveTo === null || row.effectiveTo > today) {
      inForce.push(row)
    } else {
      history.push(row)
    }
  }
  return { inForce, scheduled, history }
}

/**
 * "12,500.00 LKR" — grouped digits, two decimals, the currency code as
 * literal text after it (never an `Intl` currency style, which can resolve
 * to a bare symbol — see the spec's a11y note: currency must be readable as
 * text, not inferred from a glyph).
 *
 * Takes the driver's STRING form of a `numeric` column and formats it with
 * string operations only — no `Number()` round-trip, which is lossy for the
 * `numeric(14,2)` project-value columns well before `Number.MAX_SAFE_INTEGER`
 * stops being the excuse.
 */
export function formatMoney(value: string | number, currency: string): string {
  const raw = typeof value === 'number' ? value.toFixed(2) : value
  const negative = raw.startsWith('-')
  const unsigned = negative ? raw.slice(1) : raw
  const [wholePart, fracPart = ''] = unsigned.split('.')
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimals = (fracPart + '00').slice(0, 2)
  return `${negative ? '-' : ''}${grouped}.${decimals} ${currency}`
}
