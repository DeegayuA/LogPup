// A task's human ID — "LOG-245" — is the project's key plus the task's
// per-project number. The number is assigned by the database (the
// tasks_assign_number trigger, migration 0077), never by app code: neon-http
// has no interactive transactions, so a read-then-insert here would hand two
// concurrent inserts the same number.
//
// A project without a key still has IDs: "P<project number>-<n>". That is why
// the apps_key_format CHECK refuses a key shaped like P<digits> — a typed key
// could otherwise collide with another project's fallback. isValidAppKey
// mirrors that CHECK exactly; change both or neither.

const APP_KEY = /^[A-Z][A-Z0-9]{1,5}$/
const FALLBACK_KEY = /^P[0-9]+$/
// The fallback is P[1-9]…: appKeyFor never prints "P012" or "P0", so a parse
// that accepted them would resolve to nothing.
const TASK_KEY = /^([A-Z][A-Z0-9]{1,5}|P[1-9][0-9]*)-([1-9][0-9]{0,6})$/

export function isValidAppKey(key: string): boolean {
  return APP_KEY.test(key) && !FALLBACK_KEY.test(key)
}

export function appKeyFor(app: { key: string | null; number: number }): string {
  return app.key ?? `P${app.number}`
}

export function formatTaskKey(app: { key: string | null; number: number }, taskNumber: number): string {
  return `${appKeyFor(app)}-${taskNumber}`
}

export function parseTaskKey(query: string): { appKey: string; number: number } | null {
  const m = TASK_KEY.exec(query.trim().toUpperCase())
  if (!m) return null
  // "P012" fits the typed-key shape but is a P<digits> word, which no project
  // can hold as a key and appKeyFor never prints — so it names nothing.
  if (FALLBACK_KEY.test(m[1]) && !/^P[1-9][0-9]*$/.test(m[1])) return null
  return { appKey: m[1], number: Number(m[2]) }
}
