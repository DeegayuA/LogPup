import { searchProviders as appsProviders } from '@/features/apps/search-providers'
import { searchProviders as bugsProviders } from '@/features/bugs/search-providers'
import { searchProviders as meetingsProviders } from '@/features/meetings/search-providers'
import { searchProviders as peopleProviders } from '@/features/people/search-providers'
import { searchProviders as sprintsProviders } from '@/features/sprints/search-providers'
import { MIN_QUERY_LENGTH } from './limits'
import type { SearchContext, SearchGroup, SearchProvider } from './types'

/**
 * Everything universal search looks in. Server side only — this module reaches
 * the database through each provider and must never be imported from a
 * 'use client' file. It is imported by features/search/actions.ts, which is
 * where the auth check lives.
 *
 * ADDING A SEARCHABLE THING? Put a `search-providers.ts` in your feature
 * directory exporting `searchProviders: SearchProvider[]`, and add one import
 * line below. registry.test.ts fails if a provider file exists that nothing
 * imports, and if a feature has neither a provider nor an entry in its
 * NO_SEARCH list. Write the query out by hand inside the provider — see the
 * comment on SearchProvider.search for why a table-driven registry would
 * silently disable the soft-delete guard.
 */
export const ALL_PROVIDERS: SearchProvider[] = [
  ...appsProviders,
  ...peopleProviders,
  ...sprintsProviders,
  ...meetingsProviders,
  ...bugsProviders,
].sort((a, b) => a.rank - b.rank)

/**
 * Ask every provider at once.
 *
 * One Promise.all, not a loop with an await in it: these are separate HTTP
 * round trips to Neon, and running them in sequence would multiply the
 * palette's latency by the number of registered providers — the cost of
 * adding a provider has to stay near zero or nobody will add one.
 *
 * A provider that throws yields an empty group instead of failing the whole
 * search: one broken query should cost you its own rows, not the palette.
 */
export async function runProviders(query: string, ctx: SearchContext): Promise<SearchGroup[]> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LENGTH) return []

  const groups = await Promise.all(
    ALL_PROVIDERS.map(async (provider) => ({
      providerId: provider.id,
      label: provider.label,
      hits: await provider.search(trimmed, ctx).catch(() => []),
    })),
  )
  return groups.filter((group) => group.hits.length > 0)
}
