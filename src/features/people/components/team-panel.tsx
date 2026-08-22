'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ContactButtons } from '@/components/contact-buttons'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { downloadCsv } from '@/features/admin/components/csv-download'
import { removeAssignment } from '@/features/people/actions'
import { TEAM_CSV_HEADERS, teamCsvPrefix, teamCsvRows } from '@/features/people/team-csv'
import { AssignDialog } from '@/features/people/components/assign-dialog'
import type { ActiveUser, TeamMember } from '@/features/people/queries'

export function TeamPanel({
  appId,
  appSlug,
  appName,
  team,
  activeUsers,
  isAdmin,
  pmUserId = null,
  leadUserId = null,
}: {
  appId: string
  /** Names the downloaded roster: `logpup-team-2026-08-22.csv`. */
  appSlug?: string
  /** Prefills the WhatsApp message with which project this is about. */
  appName?: string
  team: TeamMember[]
  activeUsers: ActiveUser[]
  isAdmin: boolean
  /**
   * Who holds the project's two tracked positions. Passed in rather than read
   * off the member rows because a PM or lead need not be ASSIGNED to the
   * project — the two are separate facts in the schema.
   */
  pmUserId?: string | null
  leadUserId?: string | null
}) {
  const [isPending, startTransition] = useTransition()

  function handleRemove(assignmentId: string) {
    startTransition(async () => {
      try {
        const res = await removeAssignment(assignmentId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Member removed')
      } catch {
        // A thrown error (e.g. DB outage) is not `{ ok: false }` — without
        // this catch it's an unhandled rejection and Remove silently does
        // nothing. Same fix AssignDialog.handleSubmit documents.
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    // id="team": the person page's app chips and workload rows deep-link to
    // /apps/[slug]#team, so acting on an allocation seen there lands on this
    // panel instead of the top of the app page. scroll-mt clears the sticky
    // app header.
    <div id="team" className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-heading text-base font-medium">Team</h2>
          {team.length > 0 ? (
            <span className="font-mono text-xs text-muted-foreground">{team.length}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Exports exactly the rows rendered below — the same property
              downloadCsv is built around, so the file can never hand back
              somebody this reader was not already shown. Hidden when there is
              nobody to export rather than downloading an empty file. */}
          {team.length > 0 && appSlug ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadCsv(
                  teamCsvPrefix(appSlug),
                  TEAM_CSV_HEADERS,
                  teamCsvRows(team, { pmUserId, leadUserId }),
                )
              }
            >
              <Download aria-hidden /> CSV
            </Button>
          ) : null}
          {isAdmin ? (
          <AssignDialog
            appId={appId}
            activeUsers={activeUsers}
            trigger={
              <Button variant="outline" size="sm">
                <Plus /> Add member
              </Button>
            }
          />
          ) : null}
        </div>
      </div>
      {team.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">No one&apos;s on this app yet.</p>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? 'Add the first member to get things moving.' : 'Ask an admin to assign someone.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {team.map((member) => (
            <li key={member.assignmentId} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar size="sm">
                {member.avatarUrl ? (
                  <AvatarImage src={member.avatarUrl} alt={member.name} />
                ) : null}
                <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/people/${member.userId}`}
                  title={member.email}
                  className="w-fit max-w-full truncate rounded-sm text-sm font-medium underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {member.name}
                </Link>
                <span className="truncate text-xs text-muted-foreground">{member.role}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(member.allocationPct, 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                  {member.allocationPct}%
                </span>
              </div>
              <ContactButtons name={member.name} phone={member.phone} context={appName} />
              {isAdmin ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  <AssignDialog
                    appId={appId}
                    activeUsers={activeUsers}
                    assignment={member}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit assignment"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove member"
                          className="text-muted-foreground hover:text-destructive"
                        />
                      }
                    >
                      <Trash2 />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes them from the app&apos;s team. They can be re-added
                          later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={isPending}
                          onClick={() => handleRemove(member.assignmentId)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
