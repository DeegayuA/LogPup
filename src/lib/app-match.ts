/**
 * Resolves a free-text app hint (quick-add "on <app>" phrases, and the
 * no-appId inference ladder's rung 4 — title/agenda vs apps.name) to exactly
 * one app, or null when the guess would be a coin flip.
 *
 * Extracted verbatim-in-behaviour from meeting-form.tsx, where it powers live
 * quick-add parsing — do not change its semantics here. An exact name match
 * always wins outright; short of that, a query that substring-matches more
 * than one app is genuinely ambiguous and resolves to nothing rather than
 * guessing, which is why the caller (meeting-form's resolveQuickAdd) leaves
 * an unresolved hint on the title instead of silently dropping it.
 */

export type AppOption = { id: string; name: string }

export function matchApp(query: string, apps: AppOption[]): AppOption | null {
  const q = query.toLowerCase()
  const exact = apps.filter((app) => app.name.toLowerCase() === q)
  const matches = exact.length > 0 ? exact : apps.filter((app) => app.name.toLowerCase().includes(q))
  // Two candidates is no better than none — the app select stays untouched.
  return matches.length === 1 ? matches[0] : null
}
