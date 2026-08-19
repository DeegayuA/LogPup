import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AiAdoptionCard } from '@/features/admin/components/ai-adoption-card'
import { listAllUsers, listPendingUsers } from '@/features/admin/queries'
import { getTrash } from '@/features/admin/trash-queries'
import { listPendingAbsences } from '@/features/worklog/absence-queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

/**
 * Org health at a glance, and what is waiting on somebody.
 *
 * Every tile links to the section that acts on it — a count you cannot act on
 * is a decoration. Nothing here renders a bare percentage: coverage figures
 * come from CoverageFigure, which cannot produce one.
 */
export default async function AdminOverviewPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'admin.view')) notFound()

  const [pendingUsers, allUsers, pendingAbsences, trashGroups] = await Promise.all([
    can(actor, 'user.approve') ? listPendingUsers() : Promise.resolve([]),
    can(actor, 'user.view.detail') ? listAllUsers() : Promise.resolve([]),
    listPendingAbsences(actor),
    can(actor, 'trash.view') ? getTrash() : Promise.resolve([]),
  ])

  const activeUserCount = allUsers.filter((u) => u.active).length
  const waiting = pendingUsers.length + pendingAbsences.length
  const trashCount = trashGroups.reduce((sum, g) => sum + g.totalCount, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Waiting on someone"
          value={waiting}
          href="/admin/approvals"
          detail={`${pendingUsers.length} signups · ${pendingAbsences.length} leave`}
        />
        <Stat
          label="Active people"
          value={activeUserCount}
          href="/admin/people"
          detail={`of ${allUsers.length} approved`}
        />
        <Stat
          label="In the trash"
          value={trashCount}
          href="/admin/trash"
          detail="restorable"
        />
      </div>

      {waiting === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing is waiting on you</CardTitle>
            <CardDescription>
              Signups, leave requests and change requests all land in Approvals. When one
              arrives it shows up here with its age.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <AiAdoptionCard activeUserCount={activeUserCount} />
    </div>
  )
}

function Stat({
  label,
  value,
  href,
  detail,
}: {
  label: string
  value: number
  href: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border p-4 transition-colors duration-150 ease-out hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <CardContent className="flex flex-col gap-1 p-0">
        <span className="text-2xs text-muted-foreground">{label}</span>
        {/* Data values are mono and tabular, and never larger than text-lg —
            hierarchy comes from weight and colour before size. */}
        <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
        <span className="text-2xs text-muted-foreground">{detail}</span>
      </CardContent>
    </Link>
  )
}
