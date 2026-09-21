export const AI_FEATURES_STORAGE_KEY = 'logpup:ai-features-open'
export const AI_FEATURES_EVENT = 'logpup:ai-features-toggle'
export const AI_FEATURES_HASH = '#ai-features'

/**
 * Resolves whether the AI features card should be open based on raw stored
 * preference and optional location hash.
 *
 * Hash presence (#ai-features) takes precedence so command palette navigation
 * always expands the card regardless of prior state.
 */
export function resolveAiFeaturesOpen(
  raw: string | null | undefined,
  hash?: string,
): boolean {
  if (hash === AI_FEATURES_HASH) return true
  if (raw === 'true') return true
  return false
}

/**
 * The concise summary string displayed in the card header pill when collapsed.
 */
export function formatAiFeaturesSummaryBadge(
  totalCalls: number,
  enabledCount: number,
  totalFeatures: number,
): string {
  if (totalCalls > 0) {
    return `${totalCalls} calls in 30d`
  }
  return `${enabledCount} of ${totalFeatures} active`
}

/**
 * The accessible button label for the collapse/expand trigger.
 */
export function aiFeaturesToggleLabel(open: boolean): 'Collapse' | 'Expand' {
  return open ? 'Collapse' : 'Expand'
}
