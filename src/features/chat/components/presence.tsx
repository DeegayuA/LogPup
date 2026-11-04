import { cn } from '@/lib/utils'
import { STATUS_EMOJI, STATUS_LABEL, type PresenceStatus } from '@/features/chat/chat'

/**
 * A person's status as a small emoji badge. The emoji is the visible
 * signal and the label is in the accessibility tree (and the tooltip), so
 * the status never rests on colour alone. No status renders nothing — an
 * expired status has already been turned into "none" on the server.
 *
 * No hooks, so it renders on either side of the boundary.
 */
export type PresenceValue = { status: PresenceStatus; note: string | null; expiresAt?: Date | string | null }

export function presenceText(p: PresenceValue): string {
  return p.note ? `${STATUS_LABEL[p.status]} — ${p.note}` : STATUS_LABEL[p.status]
}

export function PresenceDot({
  presence,
  className,
}: {
  presence: PresenceValue | null | undefined
  className?: string
}) {
  if (!presence) return null
  const text = presenceText(presence)
  return (
    <span
      title={text}
      className={cn(
        'inline-flex size-4 items-center justify-center rounded-full bg-card text-[10px] leading-none ring-1 ring-border',
        className,
      )}
    >
      <span aria-hidden>{STATUS_EMOJI[presence.status]}</span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

/** The status written out, for headers and the picker. */
export function PresenceLabel({ presence, className }: { presence: PresenceValue | null | undefined; className?: string }) {
  if (!presence) return null
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
      <span aria-hidden>{STATUS_EMOJI[presence.status]}</span>
      <span className="truncate">{presenceText(presence)}</span>
    </span>
  )
}
