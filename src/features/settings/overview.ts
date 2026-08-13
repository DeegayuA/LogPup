// Pure derivations for the Settings page — separated from the page so the
// wording (which is the whole product here) is unit-testable without a DOM,
// a database, or a session.

import type { ChangelogEntry } from '@/lib/changelog'
import type { ReadinessLevel } from '@/features/gemini/readiness'

/**
 * The changelog entry describing the build the user is currently running.
 *
 * Returns null rather than throwing or guessing when the generated history
 * has no matching row. That is a real state, not a defensive nicety:
 * src/lib/changelog.data.json is written by `prebuild`
 * (scripts/generate-changelog.mjs), and the generator deliberately bails out
 * — leaving whatever file was already committed — when git history is
 * unavailable (shallow clone, no git). The committed `current` can therefore
 * name a version whose entry a stale/shallow history doesn't contain, and the
 * honest answer then is "we don't know what changed", not a wrong date.
 */
export function findRelease(version: string, history: ChangelogEntry[]): ChangelogEntry | null {
  return history.find((entry) => entry.version === version) ?? null
}

/**
 * A readiness level rendered as something a person can read.
 *
 * `word` exists because a Badge colour is not an accessible state: WCAG 1.4.1
 * requires colour never be the only carrier of meaning, so every level gets a
 * distinct word and the variant merely reinforces it. The test below pins
 * that the words stay distinct — a copy edit that collapsed two levels onto
 * the same word would silently make the badge colour load-bearing again.
 */
export type AiStatus = {
  word: string
  variant: 'default' | 'secondary' | 'destructive'
}

export function describeAiStatus(level: ReadinessLevel): AiStatus {
  switch (level) {
    case 'ready':
      return { word: 'Ready', variant: 'default' }
    case 'degraded':
      return { word: 'Partly working', variant: 'secondary' }
    case 'blocked':
      return { word: 'Not ready', variant: 'destructive' }
  }
}
