'use client'

import { startTransition, useOptimistic, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TAB_VALUES = ['overview', 'board', 'roadmap', 'meetings', 'settings'] as const
type TabValue = (typeof TAB_VALUES)[number]

function normalizeTab(value: string | undefined): TabValue {
  return (TAB_VALUES as readonly string[]).includes(value ?? '')
    ? (value as TabValue)
    : 'overview'
}

export function AppTabs({
  overview,
  board,
  roadmap,
  meetings,
  settings,
  initialTab,
}: {
  overview: ReactNode
  board: ReactNode
  roadmap?: ReactNode
  meetings: ReactNode
  settings?: ReactNode
  initialTab?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The URL owns the active tab, so a shared link, a reload and the back
  // button all land on the same tab. That makes this a CONTROLLED Tabs:
  // `defaultValue` would be re-initialised every time router.replace below
  // re-renders the page with a new `initialTab`, which is exactly what Base
  // UI warns about ("changing the default value state of an uncontrolled
  // Tabs after being initialized").
  // Roadmap and Settings are conditional (Settings is admin-only), so a link
  // to ?tab=settings can outlive the permission that produced it. Falling back
  // to Overview keeps that a working page rather than a tab with no panel.
  const available = new Set<TabValue>(['overview', 'board', 'meetings'])
  if (roadmap) available.add('roadmap')
  if (settings) available.add('settings')
  const requested = normalizeTab(searchParams.get('tab') ?? initialTab)
  const urlTab = available.has(requested) ? requested : 'overview'

  // ...but the URL round-trips through the server, so switching on `urlTab`
  // alone would leave the tab visibly lagging the click. The optimistic value
  // paints immediately and is reconciled back to the URL once the navigation
  // settles — including when it fails, which snaps the tab back rather than
  // stranding it on a tab the URL doesn't agree with.
  const [activeTab, setActiveTab] = useOptimistic(urlTab)

  function handleValueChange(value: string) {
    startTransition(() => {
      setActiveTab(normalizeTab(value))
      // Copy the existing params (e.g. ?sprint=...) so switching tabs never
      // clobbers whatever else is in the URL.
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', value)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  // Underline-style tab bar: the trigger's own border-b-2 sits on the list's
  // hairline border, so the active indicator reads as a single primary rule.
  const triggerClassName =
    'h-full flex-none rounded-none border-0 border-b-2 border-transparent px-3 font-normal text-muted-foreground transition-colors duration-150 after:hidden hover:text-foreground data-active:border-primary data-active:font-medium data-active:text-foreground'

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => handleValueChange(value as string)}
      className="flex flex-1 flex-col gap-4"
    >
      <TabsList variant="line" className="w-full justify-start gap-1 border-b border-border p-0">
        <TabsTrigger value="overview" className={triggerClassName}>
          Overview
        </TabsTrigger>
        <TabsTrigger value="board" className={triggerClassName}>
          Board
        </TabsTrigger>
        {roadmap ? (
          <TabsTrigger value="roadmap" className={triggerClassName}>
            Roadmap
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="meetings" className={triggerClassName}>
          Meetings
        </TabsTrigger>
        {settings ? (
          <TabsTrigger value="settings" className={triggerClassName}>
            Settings
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="board">{board}</TabsContent>
      {roadmap ? <TabsContent value="roadmap">{roadmap}</TabsContent> : null}
      <TabsContent value="meetings">{meetings}</TabsContent>
      {settings ? <TabsContent value="settings">{settings}</TabsContent> : null}
    </Tabs>
  )
}
