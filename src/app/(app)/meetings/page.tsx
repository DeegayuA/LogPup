import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { listMeetings } from '@/features/meetings/queries'
import { listApps } from '@/features/apps/queries'
import { listActiveUsers } from '@/features/people/queries'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { MeetingsViews } from '@/features/meetings/components/meetings-views'
import { splitByUpcoming } from '@/features/meetings/split-upcoming'

export default async function MeetingsPage(props: { searchParams: Promise<{ new?: string }> }) {
  const [{ new: newParam }, session, allMeetings, apps, activeUsers] = await Promise.all([
    props.searchParams,
    auth(),
    listMeetings({ upcomingOnly: false }),
    listApps(),
    listActiveUsers(),
  ])

  // `allMeetings` is already ordered newest-first, which is what the past
  // section wants (most recent past meeting first); splitByUpcoming
  // re-sorts only the upcoming half to soonest-first.
  const { upcoming, past } = splitByUpcoming(allMeetings)

  const currentUserId = session?.user?.id ?? ''
  const isAdmin = session?.user?.role === 'admin'
  const appOptions = apps.map((app) => ({ id: app.id, name: app.name }))

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-medium">Meetings</h1>
        <MeetingForm
          apps={appOptions}
          activeUsers={activeUsers}
          trigger={<Button>New meeting</Button>}
          defaultOpen={newParam === '1'}
        />
      </div>

      <MeetingsViews
        upcoming={upcoming}
        past={past}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        users={activeUsers}
      />
    </div>
  )
}
