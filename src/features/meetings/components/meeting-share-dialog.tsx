'use client'

import { useEffect, useState } from 'react'
import { CheckIcon, CopyIcon, Loader2, MailIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { waHref } from '@/lib/phone'
import { buildMeetingShareMessage, mailtoHref } from '@/features/meetings/share'
import {
  getMeetingShareInfo,
  type MeetingShareInfo,
} from '@/features/meetings/share-actions'

/**
 * The share sheet shown right after a meeting is created.
 *
 * Two truths shape it. Google Calendar has ALREADY emailed the invite to
 * every attendee by the time this opens (sendUpdates:'all' on the event, Meet
 * link included) — so this is the extra nudge for people who live in
 * WhatsApp, not the primary delivery. And nothing here sends anything: wa.me
 * and mailto: both end at a compose box with the organiser's thumb on the
 * send button, the same contract as contact-buttons.tsx. WhatsApp has no
 * legitimate "send silently on someone's behalf" API — pretending otherwise
 * would mean a Business-API integration and Meta approval, not a deep link.
 *
 * WhatsApp is one button per person because wa.me addresses one chat; email
 * is one button for everyone because mailto: takes the whole list.
 */
export function MeetingShareDialog({
  meetingId,
  onClose,
}: {
  /** null keeps the dialog closed; an id loads that meeting's share info. */
  meetingId: string | null
  onClose: () => void
}) {
  return (
    <Dialog open={meetingId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share the invite</DialogTitle>
          <DialogDescription>
            Google Calendar has emailed everyone already — this is the extra nudge. Each
            button opens a chat with the message filled in; you press send.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed by meeting id so closing unmounts all fetch/copy state and a
            reopen starts clean — the remount IS the reset, in place of a
            synchronous state-clearing effect the lint rightly rejects. */}
        {meetingId ? <ShareContent key={meetingId} meetingId={meetingId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ShareContent({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const [info, setInfo] = useState<MeetingShareInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMeetingShareInfo(meetingId)
      .then((res) => {
        if (cancelled) return
        if (res.ok) setInfo(res.data)
        else toast.error(res.error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [meetingId])

  const message = info
    ? buildMeetingShareMessage({
        title: info.title,
        startsAt: new Date(info.startsAt),
        meetingUrl: info.meetingUrl,
      })
    : ''

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the text instead')
    }
  }

  return (
    <>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
            <span className="sr-only">Loading attendees…</span>
          </div>
        ) : info ? (
          <div className="flex flex-col gap-4">
            <pre className="rounded-md border border-border bg-muted/40 px-3 py-2 font-sans text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {message}
            </pre>

            <ul className="flex flex-col gap-1.5">
              {info.attendees.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{person.name}</span>
                  {person.phone ? (
                    <a
                      href={waHref(person.phone, message)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`WhatsApp ${person.name} the invite`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {/* Same inline WhatsApp glyph as contact-buttons.tsx — lucide has no brand icons. */}
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-3.5">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                      </svg>
                      WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">no phone saved</span>
                  )}
                </li>
              ))}
            </ul>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" size="sm" onClick={copyMessage} type="button">
                {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                {copied ? 'Copied' : 'Copy message'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href={mailtoHref(
                      info.attendees.map((p) => p.email),
                      `Invite: ${info.title}`,
                      message,
                    )}
                  />
                }
              >
                <MailIcon aria-hidden /> Email everyone
              </Button>
              <Button size="sm" onClick={onClose} type="button">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : null}
    </>
  )
}
