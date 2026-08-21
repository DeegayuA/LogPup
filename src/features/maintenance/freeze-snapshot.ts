/**
 * "Could a maintenance window be armed right now?" — answered synchronously,
 * with no database and no imports at all.
 *
 * WHY THIS EXISTS. The write gate in src/db/index.ts sits in front of every
 * db.insert/update/delete in the app, on the hot path of every request. Asking
 * the database "is maintenance on" before each of those would put a query in
 * front of every write in LogPup, forever, to answer "no" on all but a few
 * hours a year.
 *
 * So the gate asks this first. It is a per-process hint, not a decision:
 *
 *   false  — a read in THIS process proved nothing is armed. Skip the gate
 *            entirely; the write path stays byte-for-byte what it was.
 *   true   — either something is armed, or this process has never looked. Pay
 *            for the real, request-scoped, admin-aware check.
 *
 * UNKNOWN DELIBERATELY READS AS "MIGHT BE". A fresh serverless instance that
 * has never read the row must not conclude the workspace is open — it must go
 * and find out. Every other module here fails open; this one does not, because
 * the cost of being wrong is one query rather than a lockout.
 *
 * It is only ever a hint. `enabled` flipping in another instance leaves this
 * one saying "false" until its next read of the row, which is why the
 * authoritative gate (write-freeze.ts) re-reads and why the capability layer
 * checks independently. Nothing here decides anything on its own.
 */

let armed: boolean | undefined

/** Called by every read of the window, with whatever that read found. */
export function noteMaintenanceArmed(value: boolean): void {
  armed = value
}

/** False ONLY when a read in this process proved nothing is armed. */
export function maintenanceMightBeArmed(): boolean {
  return armed !== false
}

/** For tests: forget what this process learned. */
export function resetMaintenanceSnapshot(): void {
  armed = undefined
}
