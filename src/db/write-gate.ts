import { getTableName, type Table } from 'drizzle-orm'
import { maintenanceMightBeArmed } from '@/features/maintenance/freeze-snapshot'

/**
 * THE WRITE FREEZE, at the database boundary.
 *
 * This is the layer Firestore would put in rules: not "the UI hid the button"
 * and not "the action guard said no", but the last thing between an insert and
 * the table. It exists because fourteen files in this codebase write to the
 * database without ever calling requireCapability — the capability guard is
 * the polite refusal, and this is the one that cannot be walked around.
 *
 * READS ARE NOT GATED, DELIBERATELY. A maintenance window stops the workspace
 * changing; it does not stop it being looked at. Putting a gate in front of
 * reads would mean every SELECT in the app carries a maintenance check forever,
 * to answer "no window" on every day of the year, and it would blank the very
 * pages that explain why the app is quiet. `lockdown` stops people looking, and
 * it stops them at the UI, which is the honest place to say so: someone holding
 * a session token can always read. The freeze is about writes, and it is total.
 *
 * COSTS NOTHING WHEN NOTHING IS ARMED. maintenanceMightBeArmed() is a
 * synchronous per-process hint with no query behind it; when it says no, the
 * builder is handed back untouched and the write path is byte-for-byte what it
 * was before this file existed.
 */

/**
 * Tables that stay writable THROUGH a freeze, each with the reason.
 *
 * This is the `except` arm of the spec's rule, and every entry is a table
 * without which the window could not be ended or explained:
 *
 *  - users, webauthn_login_tokens — SIGNING IN IS A WRITE. Provisioning, the
 *    avatar refresh on a Google login and the single-use passkey token all
 *    touch these. Freeze them and the admin who needs to end the window cannot
 *    get in to end it, which is the one failure this feature must not have.
 *    Ordinary edits to a user are still refused, by requireCapability, which
 *    gates user.profile.edit and user.role.grant like every other write.
 *  - activity_log — an append-only record that must never fail the thing it
 *    describes; logActivity already swallows its own errors for that reason.
 *  - notifications — the lifecycle announcements ARE notifications. Freezing
 *    them would mean the window could never tell anybody it had started.
 *  - maintenance_window — the switch itself. Freezing it would make the freeze
 *    permanent.
 */
const FREEZE_EXEMPT_TABLES: ReadonlySet<string> = new Set([
  'users',
  'webauthn_login_tokens',
  'activity_log',
  'notifications',
  'maintenance_window',
])

/** Query builders this gate is holding. Consulted by the batch arm. */
const gated = new WeakSet<object>()

function isExemptTable(table: unknown): boolean {
  if (table === null || typeof table !== 'object') return false
  try {
    return FREEZE_EXEMPT_TABLES.has(getTableName(table as Table))
  } catch {
    // Not a table this build recognises. Gate it — an unrecognised target is
    // not a reason to let a write through a freeze.
    return false
  }
}

/**
 * Imported at call time so `@/db` does not statically depend on the feature
 * that reads `@/db`. The module loader caches it after the first await, so the
 * dynamic import costs nothing on any later write.
 */
async function assertWritable(): Promise<void> {
  const { assertWritable: check } = await import('@/features/maintenance/write-freeze')
  await check()
}

/**
 * Wrap a builder so the freeze is checked when it is finally awaited, not when
 * it is constructed.
 *
 * `then` is the only interception. Everything else is passed through bound to
 * the real builder — `Reflect.get(target, prop, target)` rather than the proxy,
 * so drizzle's own getters and private state see the object they were written
 * for. Chained calls return builders, which are re-wrapped, so `.values()`,
 * `.where()`, `.set()`, `.returning()` and `.onConflictDoNothing()` all stay
 * gated right through to the await that runs them.
 */
function wrap<T extends object>(node: T): T {
  const proxy = new Proxy(node, {
    get(target, prop) {
      if (prop === 'then') {
        const then = Reflect.get(target, prop, target)
        if (typeof then !== 'function') return then
        return (onFulfilled?: unknown, onRejected?: unknown) =>
          assertWritable().then(
            () => (then as (a?: unknown, b?: unknown) => unknown).call(target, onFulfilled, onRejected),
            (error: unknown) => {
              if (typeof onRejected === 'function') return (onRejected as (e: unknown) => unknown)(error)
              throw error
            },
          )
      }
      const value = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(target, args)
        return result !== null && typeof result === 'object' ? wrap(result as object) : result
      }
    },
  })
  gated.add(proxy)
  return proxy
}

/** Applied to the builder every db.insert / db.update / db.delete returns. */
export function gateWrite<T>(table: unknown, builder: T): T {
  if (!maintenanceMightBeArmed()) return builder
  if (isExemptTable(table)) return builder
  if (builder === null || typeof builder !== 'object') return builder
  return wrap(builder as object) as unknown as T
}

/**
 * db.batch runs its statements itself rather than awaiting them, so `then` is
 * never reached and the per-builder gate above cannot fire. The items are the
 * builders this gate already wrapped, which is exactly the signal needed: a
 * batch holding even one freezable statement is checked before it runs, and a
 * batch of nothing but exempt-table writes (the passkey login token is the live
 * case) passes straight through.
 */
export async function gateBatch(items: unknown): Promise<void> {
  if (!maintenanceMightBeArmed()) return
  if (!Array.isArray(items)) return
  if (!items.some((item) => item !== null && typeof item === 'object' && gated.has(item as object))) return
  await assertWritable()
}
