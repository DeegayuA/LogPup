import { PawPrint } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { getSession } from '@/lib/session'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { listActiveUsers } from '@/features/people/queries'
import { listApps, listDistinctTechTags } from '@/features/apps/queries'
import { summarizePortfolio } from '@/features/apps/app-health'
import { browseHref, parseBrowseParams } from '@/features/apps/browse'
import { AppsBrowser } from '@/features/apps/components/apps-browser'
import { PortfolioSummaryStrip } from '@/features/apps/components/portfolio-summary'
import { AppFormDialog } from '@/features/apps/components/app-form-dialog'
import { isAdminRole } from '@/features/auth/capabilities'
import { getAiPrefs } from '@/features/gemini/prefs'

export default async function AppsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // One batch, deliberately including the two admin-only lookups that feed
  // the New app dialog. Gating them on `isAdmin` would mean awaiting the
  // session first, which serializes this batch behind it for zero benefit —
  // the two lookups are indexed and run in parallel anyway.
  //
  // The session read itself is `getSession`, not `auth()`: the (app) layout
  // has already read it for this request, so this is a memo hit rather than
  // the second of three identical `select … from users` round trips (see
  // lib/session.ts).
  const [rawParams, session, apps, workspaceTechTags, activeUsers] = await Promise.all([
    props.searchParams,
    getSession(),
    listApps(),
    listDistinctTechTags(),
    listActiveUsers(),
  ])
  const isAdmin = session?.user ? isAdminRole(session.user.role) : false
  const params = parseBrowseParams(rawParams)
  // Only AppFormDialog reads this, and only admins ever see it — a member
  // pays nothing for a preference lookup they have no control that needs it.
  const aiPrefs = isAdmin && session?.user ? await getAiPrefs(session.user.id) : null
  const appMetadataEnabled = aiPrefs ? aiPrefs['app-metadata'].enabled : true

  // One shared "today" for the whole page: the header strip, every card's
  // sprint bar and every health verdict must agree on which day it is, and
  // recomputing it per component would let a render that straddles midnight
  // disagree with itself. Colombo-local, matching the sprint queries.
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const summary = summarizePortfolio(apps)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* PageHeader (shared primitive): one h1 treatment across every (app)
          page instead of a per-page hand-rolled header row. */}
      <PageHeader
        title="Apps"
        description="Every product the team is building — what is moving, and what is not."
        actions={
          isAdmin ? (
            <AppFormDialog
              defaultOpen={rawParams.new === '1'}
              workspaceTechTags={workspaceTechTags}
              activeUsers={activeUsers}
              aiGenerateEnabled={appMetadataEnabled}
            />
          ) : undefined
        }
      />

      {apps.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title="No apps in the kennel yet."
          description={
            isAdmin
              ? 'Hit New app above to give LogPup something to watch. Once an app has a sprint and a team, this page turns into your portfolio view.'
              : 'An admin can add the first app for the pack.'
          }
          className="flex-1 rounded-xl border border-dashed border-border p-12"
        />
      ) : (
        <>
          <PortfolioSummaryStrip
            summary={summary}
            // Narrows the grid to the apps this tile is counting. It used to
            // point at `{ sort: 'risk', status: 'live' }` — both of which are
            // the defaults, so from the page you actually land on the link
            // resolved to the URL you were already on and did nothing.
            atRiskHref={browseHref('/apps', params, { risk: 'at-risk', status: 'live' })}
          />
          <AppsBrowser apps={apps} params={params} today={today} />
        </>
      )}
    </div>
  )
}
