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

export const metadata = { title: 'App Portfolio' }

export default async function AppsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [rawParams, session, apps, workspaceTechTags, activeUsers] = await Promise.all([
    props.searchParams,
    getSession(),
    listApps(),
    listDistinctTechTags(),
    listActiveUsers(),
  ])
  const isAdmin = session?.user ? isAdminRole(session.user.role) : false
  const params = parseBrowseParams(rawParams)
  const aiPrefs = isAdmin && session?.user ? await getAiPrefs(session.user.id) : null
  const appMetadataEnabled = aiPrefs ? aiPrefs['app-metadata'].enabled : true

  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const summary = summarizePortfolio(apps)

  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8 overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 -z-10 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl"
        aria-hidden
      />

      <PageHeader
        title="App Portfolio"
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
          className="flex-1 rounded-2xl border border-dashed border-border/80 p-12 bg-card/40 backdrop-blur-sm"
        />
      ) : (
        <>
          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-sm">
            <PortfolioSummaryStrip
              summary={summary}
              atRiskHref={browseHref('/apps', params, { risk: 'at-risk', status: 'live' })}
            />
          </div>
          <AppsBrowser
            apps={apps}
            params={params}
            today={today}
            viewerId={session?.user?.id ?? null}
          />
        </>
      )}
    </div>
  )
}
