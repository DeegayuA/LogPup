'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import {
  ArrowUpRightIcon,
  CalendarPlusIcon,
  DownloadIcon,
  Loader2,
  SendIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { retryCalendarInvite } from '@/features/meetings/actions'
import { googleCalendarUrl, outlookCalendarUrl } from '@/features/meetings/ics'
import type { MeetingSummary } from '@/features/meetings/queries'

/** The download endpoint for a meeting's RFC 5545 invite. */
export function icsHref(meetingId: string): string {
  return `/api/meetings/${meetingId}/ics`
}

/**
 * Offers the calendar paths that cannot fail: a downloadable `.ics` file and
 * prefilled "add to calendar" links for Google and Outlook. None of them
 * involve an OAuth token or a third-party API call of ours, so they work for
 * every user regardless of how they signed in.
 *
 * The Google Calendar API invite — the one that has been failing — is kept as
 * a best-effort extra at the bottom of the menu for organisers whose Google
 * connection is actually alive. When it fails, the toast says so in plain
 * words and hands over the working alternative in the same breath, instead of
 * offering a retry that fails the same way.
 */
export function AddToCalendarMenu({
  meeting,
  canManage,
  size = 'sm',
}: {
  meeting: Pick<
    MeetingSummary,
    'id' | 'title' | 'agenda' | 'meetingUrl' | 'startsAt' | 'endsAt' | 'googleEventId'
  >
  /** Organisers and admins additionally see the best-effort Google API item. */
  canManage: boolean
  size?: 'xs' | 'sm'
}) {
  const [isPending, startTransition] = useTransition()

  const linkInput = {
    title: meeting.title,
    description: meeting.agenda,
    location: meeting.meetingUrl,
    url: meeting.meetingUrl,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
  }

  function downloadIcs() {
    // Content-Disposition: attachment on the route turns this into a download
    // rather than a navigation, so the current page is left untouched.
    window.location.assign(icsHref(meeting.id))
  }

  function handleGoogleInvite() {
    startTransition(async () => {
      try {
        const res = await retryCalendarInvite(meeting.id)
        if (!res.ok) {
          // The action button IS the fallback instruction — no description
          // repeating it in prose (the toast was three redundant sentences).
          toast.error(res.error, {
            action: { label: 'Download invite', onClick: downloadIcs },
            duration: 10_000,
          })
          return
        }
        toast.success('Google Calendar invite sent')
      } catch {
        toast.error('Google Calendar could not be reached', {
          action: { label: 'Download invite', onClick: downloadIcs },
          duration: 10_000,
        })
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size={size} type="button" disabled={isPending} />}
      >
        {isPending ? <Loader2 aria-hidden className="animate-spin" /> : <CalendarPlusIcon />}
        Add to calendar
      </DropdownMenuTrigger>
      {/* Every label lives inside its own group: Base UI's GroupLabel reads
          MenuGroupContext and throws outright when it is rendered as a bare
          child of the popup. */}
      <DropdownMenuContent align="end" className="w-auto min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Works everywhere</DropdownMenuLabel>
          <DropdownMenuItem onClick={downloadIcs}>
            <DownloadIcon />
            Download invite (.ics)
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a href={googleCalendarUrl(linkInput)} target="_blank" rel="noreferrer noopener" />
            }
          >
            <ArrowUpRightIcon />
            Google Calendar
            <span className="sr-only">(opens in a new tab)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <a href={outlookCalendarUrl(linkInput)} target="_blank" rel="noreferrer noopener" />
            }
          >
            <ArrowUpRightIcon />
            Outlook
            <span className="sr-only">(opens in a new tab)</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {canManage && !meeting.googleEventId ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Needs a Google connection</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleGoogleInvite} disabled={isPending}>
                <SendIcon />
                Email invites via Google
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
