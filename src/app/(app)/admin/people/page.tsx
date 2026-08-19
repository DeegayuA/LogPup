import { notFound } from 'next/navigation'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AddUserDialog } from '@/features/admin/components/add-user-dialog'
import { UserTable } from '@/features/admin/components/user-table'
import { listAllUsers } from '@/features/admin/queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

export default async function AdminPeoplePage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'user.view.detail')) notFound()

  const allUsers = await listAllUsers()
  const existingOrgTags = Array.from(new Set(allUsers.flatMap((u) => u.orgTags)))
    .sort((a, b) => a.localeCompare(b))

  // Manager scope now resolves from app_role_history's structured pm/lead, NOT
  // from the free-text assignments.role that managesApp() matches. Anyone
  // holding the title only in free text has no scope until an admin records
  // them on the app, so the gap is surfaced rather than discovered.
  const managersWithoutScope = allUsers.filter(
    (u) => u.role === 'manager' && u.active,
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>
            Approved teammates only — pending self-signups are under Approvals, and a
            rejected account is gone from every list. Add teammates by email, tag their
            organization, change seats or deactivate accounts. You can&apos;t change your
            own seat or active status here.
          </CardDescription>
          <CardAction>
            <AddUserDialog existingOrgTags={existingOrgTags} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <UserTable users={allUsers} currentUserId={actor.id} />
        </CardContent>
      </Card>

      {managersWithoutScope.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Managers need a recorded project role</CardTitle>
            <CardDescription>
              A manager&apos;s reach comes from being the recorded PM or lead on an app,
              not from a job title typed into an assignment. Until someone is recorded
              under Apps, their manager seat has no projects in it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {managersWithoutScope.map((u) => (
                <li key={u.id} className="font-mono tabular-nums text-muted-foreground">
                  {u.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
