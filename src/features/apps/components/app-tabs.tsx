'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AppTabs({
  overview,
  board,
  meetings,
  settings,
}: {
  overview: ReactNode
  board: ReactNode
  meetings: ReactNode
  settings?: ReactNode
}) {
  return (
    <Tabs defaultValue="overview" className="flex flex-1 flex-col gap-4">
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
