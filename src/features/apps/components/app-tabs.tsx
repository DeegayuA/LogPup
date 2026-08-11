'use client'

import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TAB_VALUES = ['overview', 'board', 'meetings', 'settings'] as const
type TabValue = (typeof TAB_VALUES)[number]

function normalizeTab(value: string | undefined): TabValue {
  return (TAB_VALUES as readonly string[]).includes(value ?? '')
    ? (value as TabValue)
    : 'overview'
}

export function AppTabs({
  overview,
  board,
  meetings,
  settings,
  initialTab,
}: {
  overview: ReactNode
  board: ReactNode
  meetings: ReactNode
  settings?: ReactNode
  initialTab?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleValueChange(value: string) {
    // Copy the existing params (e.g. ?sprint=...) so switching tabs never
    // clobbers whatever else is in the URL.
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs
      defaultValue={normalizeTab(initialTab)}
      onValueChange={(value) => handleValueChange(value as string)}
      className="flex flex-1 flex-col gap-4"
    >
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="board">Board</TabsTrigger>
        <TabsTrigger value="meetings">Meetings</TabsTrigger>
        {settings ? <TabsTrigger value="settings">Settings</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="board">{board}</TabsContent>
      <TabsContent value="meetings">{meetings}</TabsContent>
      {settings ? <TabsContent value="settings">{settings}</TabsContent> : null}
    </Tabs>
  )
}
