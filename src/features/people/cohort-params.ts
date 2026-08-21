import {
  PROJECT_SORTS,
  ROLE_FILTERS,
  STAFF_FILTERS,
  type ProjectSort,
  type RoleFilter,
  type StaffFilter,
} from '@/features/people/cohort-filter'

// URL params for the cohort views on /people, and the hrefs that set them.
//
// Same house rule as history-params.ts and apps/browse.ts: the whole state of
// which view is in front lives in the query string, so /people stays a server
// component and every cohort — "everyone on Falcon", "who is on both Falcon
// and Kestrel" — is a link somebody can paste into a message. Parsing is total:
// a malformed param degrades to the default rather than throwing, because these
// values arrive from bookmarks and hand-edited URLs, not from a form we control.

/** Which slice of the page is in front. Link-based, like HistoryFilters. */
export const COHORT_VIEWS = ['people', 'projects', 'shared', 'overlap'] as const
export type CohortView = (typeof COHORT_VIEWS)[number]

/** The default is the directory: /people has always opened on the roster. */
export const DEFAULT_COHORT_VIEW: CohortView = 'people'

export const COHORT_VIEW_LABEL: Record<CohortView, string> = {
  people: 'People',
  projects: 'By project',
  shared: 'Shared',
  overlap: 'Overlap',
}

/**
 * One sentence per view, shown under the page title. Each states what the view
 * answers, not what it contains — the tab label already says that.
 */
export const COHORT_VIEW_HINT: Record<CohortView, string> = {
  people:
    'What everyone is working on right now, what they have been doing, and how much room they have left.',
  projects: 'Every project as a group — who runs it, who is on it, and where it stands.',
  shared: 'People carrying more than one project, most split first.',
  overlap: 'Pick a project to see which others share people with it, and exactly whom.',
}

export type CohortParams = {
  view: CohortView
  /** Slug of the project the overlap view is anchored on. */
  project: string | undefined
  /** Free-text narrowing for "By project" — matches projects, people and roles. */
  q: string
  staff: StaffFilter
  role: RoleFilter
  sort: ProjectSort
}

export type RawCohortParams = {
  view?: string
  project?: string
  q?: string
  staff?: string
  role?: string
  sort?: string
}

/** A phrase typed into a box has no natural length; a URL does. */
const MAX_QUERY_CHARS = 80

/** Parse-or-default, the same total rule `view` follows: these arrive from
 *  bookmarks and hand-edited URLs, so an unknown value is the default rather
 *  than an error. */
function oneOf<T extends string>(allowed: readonly T[], raw: string | undefined, fallback: T): T {
  return (allowed as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback
}

/**
 * Slugs are short by construction (apps.slug), but an unbounded param has no
 * business round-tripping through a URL — it only ever feeds an equality match
 * against a slug that is already in memory.
 */
const MAX_SLUG_CHARS = 80

export function parseCohortParams(raw: RawCohortParams): CohortParams {
  const project = (raw.project ?? '').trim().slice(0, MAX_SLUG_CHARS)
  return {
    view: (COHORT_VIEWS as readonly string[]).includes(raw.view ?? '')
      ? (raw.view as CohortView)
      : DEFAULT_COHORT_VIEW,
    project: project || undefined,
    q: (raw.q ?? '').trim().slice(0, MAX_QUERY_CHARS),
    staff: oneOf(STAFF_FILTERS, raw.staff, 'all'),
    role: oneOf(ROLE_FILTERS, raw.role, 'all'),
    sort: oneOf(PROJECT_SORTS, raw.sort, 'name'),
  }
}

/** Rebuilds /people's URL with `patch` applied — the only way links are built. */
export function peopleHref(params: CohortParams, patch: Partial<CohortParams> = {}): string {
  const next = { ...params, ...patch }
  const search = new URLSearchParams()
  // The directory is the default and needs no param — a bare /people is the
  // canonical link, exactly as it was before these views existed.
  if (next.view !== DEFAULT_COHORT_VIEW) search.set('view', next.view)
  // Carried ONLY by the view that reads it. Leaving `project` in the URL on the
  // other three tabs would put a param on screen that nothing there honours,
  // and the copy on this page has to be true of what is actually rendered.
  if (next.view === 'overlap' && next.project) search.set('project', next.project)
  // Carried ONLY by the view that honours them, for the same reason `project`
  // is: a filter in the URL that the visible tab ignores is a param claiming
  // something the page is not doing. Defaults stay absent so a plain
  // ?view=projects remains the canonical link to the unfiltered grid.
  if (next.view === 'projects') {
    if (next.q) search.set('q', next.q)
    if (next.staff !== 'all') search.set('staff', next.staff)
    if (next.role !== 'all') search.set('role', next.role)
    if (next.sort !== 'name') search.set('sort', next.sort)
  }
  const query = search.toString()
  return query ? `/people?${query}` : '/people'
}
