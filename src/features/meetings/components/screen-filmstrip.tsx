'use client'

import { MonitorSpeaker, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCapturedAt } from '@/features/meetings/screen-keyframes'
import type { MeetingScreenshotView } from '@/features/meetings/ai-actions'

/**
 * The screens shared during a meeting, in captured order.
 *
 * One component for both places they appear — the live strip that grows
 * while recording, and the write-up's record of what was on screen — so a
 * thumbnail means the same thing, and carries the same timestamp, wherever
 * it is seen. That timestamp matters more than it looks: it is the exact
 * string the synthesis prompt used to label the image for the model
 * (formatCapturedAt), so a person reading "4:12" here and a model told
 * "Screen capture at 4:12" are referring to the same moment.
 */
export function ScreenFilmstrip({
  frames,
  title,
  note,
  onDelete,
  className,
}: {
  frames: MeetingScreenshotView[]
  title: string
  /** One short line of context beside the heading, or null. */
  note?: string | null
  /** Omit to render read-only — for viewers who cannot manage the meeting. */
  onDelete?: (id: string) => void
  className?: string
}) {
  // A reason to show (capture stopped early) outranks having no frames: "the
  // screen share ended" is exactly what a person needs to be told when the
  // strip they were watching is empty.
  if (frames.length === 0 && !note) return null

  return (
    <div
      className={cn('flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <MonitorSpeaker className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {title}
          <span className="font-mono text-2xs font-normal text-muted-foreground">
            {frames.length}
          </span>
        </span>
        {note ? <span className="text-2xs text-muted-foreground">{note}</span> : null}
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {frames.map((frame) => (
          <li key={frame.id} className="shrink-0">
            <figure className="flex w-32 flex-col gap-0.5">
              {/* Plain <img>: these are runtime blobs behind an auth proxy,
                  not build-time assets, so next/image's optimizer has nothing
                  to optimise and would only add a hop. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.url}
                alt={`Shared screen at ${formatCapturedAt(frame.capturedAtMs)} into the recording`}
                className="h-20 w-32 rounded-md border border-border object-cover"
                loading="lazy"
              />
              <figcaption className="flex items-center justify-between gap-1">
                <span className="font-mono text-2xs text-muted-foreground">
                  {formatCapturedAt(frame.capturedAtMs)}
                </span>
                {onDelete ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    onClick={() => onDelete(frame.id)}
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">
                      Discard the screen captured at {formatCapturedAt(frame.capturedAtMs)}
                    </span>
                  </Button>
                ) : null}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  )
}
