// Choosing where sprint exports land in Notion when NOTION_PARENT_PAGE_ID
// isn't configured.
//
// The env var used to be mandatory, which meant Notion export shipped broken
// by default: sharing a page with the integration (the unavoidable manual
// step — a bot token can't grant itself access to anything) wasn't enough,
// you also had to fish the page's UUID out of its URL and paste it into
// .env.local. The second step is pure ceremony when the integration can only
// see one page anyway — which is the normal state, since Notion's "add
// connection" UI shares exactly the page you ran it on. So: the env var
// still wins when set (explicitness beats guessing), and otherwise we ask
// the Notion search API what the integration can see and decide from that.
//
// Pure decision logic, separated from the API call (same pattern as
// recording-segments.ts vs meeting-intel.tsx) so the interesting branches —
// none / exactly one / several — are unit-testable without a Notion client.

/** The slice of a Notion search result this decision actually needs. */
export type NotionPageCandidate = {
  id: string
  /** 'workspace' for a top-level page; 'page_id'/'block_id' for subpages,
   *  'database_id' for database rows. */
  parentType: string
  title: string
}

export type ParentPageDecision =
  | { kind: 'use'; id: string; title: string }
  | { kind: 'none' }
  | { kind: 'ambiguous'; titles: string[] }

/**
 * Decides which shared page should own exported sprint pages.
 *
 * - Exactly one page visible → use it, whatever level it sits at. This is
 *   the case Notion's sharing UI naturally produces.
 * - Several visible → prefer a SINGLE top-level (workspace) page: sharing a
 *   top-level "LogPup" page whose subpages are also visible is one share
 *   action in Notion, and the top-level page is unambiguously "the" home.
 * - Anything else (nothing shared, or several equally-plausible parents) →
 *   refuse with enough information to fix it, never guess. Exports landing
 *   under an unexpected page would be quietly wrong in a way nobody notices
 *   until much later — worse than a clear error now.
 */
export function pickParentPage(candidates: NotionPageCandidate[]): ParentPageDecision {
  if (candidates.length === 0) return { kind: 'none' }
  if (candidates.length === 1) {
    return { kind: 'use', id: candidates[0].id, title: candidates[0].title }
  }
  const topLevel = candidates.filter((page) => page.parentType === 'workspace')
  if (topLevel.length === 1) {
    return { kind: 'use', id: topLevel[0].id, title: topLevel[0].title }
  }
  return {
    kind: 'ambiguous',
    titles: candidates.map((page) => page.title || '(untitled)').slice(0, 10),
  }
}
