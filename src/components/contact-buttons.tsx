import { PhoneIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { telHref, waHref } from '@/lib/phone'

/**
 * The one call + WhatsApp cluster, used everywhere a person appears.
 *
 * Plain anchors, no client JS: tel: hands off to the phone app and wa.me to
 * WhatsApp, so this stays usable inside server components. When `context` is
 * given the WhatsApp chat opens pre-filled ("automated"); without it the
 * chat opens blank ("manual"). Nothing is ever sent by the app itself —
 * both routes end at a compose box with a human's thumb on the button.
 *
 * Renders nothing without a phone number: a dead call button teaches people
 * the buttons don't work, which is worse than absence.
 */
export function ContactButtons({
  name,
  phone,
  context,
  className,
}: {
  /** Whose number this is — used in the accessible labels. */
  name: string
  phone: string | null | undefined
  /** What the message is about; prefills the WhatsApp chat when given. */
  context?: string
  className?: string
}) {
  if (!phone) return null

  const message = context ? `Hi ${name.split(' ')[0]} — about ${context}` : undefined
  const anchor =
    'inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

  return (
    <span className={cn('flex shrink-0 items-center gap-1', className)}>
      <a href={telHref(phone)} aria-label={`Call ${name}`} title={`Call ${name}`} className={anchor}>
        <PhoneIcon aria-hidden className="size-3.5" />
      </a>
      <a
        href={waHref(phone, message)}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp ${name}`}
        title={`WhatsApp ${name}`}
        className={anchor}
      >
        {/* lucide dropped brand icons, so the glyph is inline — the standard
            WhatsApp speech-bubble path, single colour, inherits currentColor. */}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-3.5">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
      </a>
    </span>
  )
}
