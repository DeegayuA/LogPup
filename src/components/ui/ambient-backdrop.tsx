import { cn } from '@/lib/utils'

/**
 * The ambient blur orbs every authed page currently inlines as two anonymous
 * divs (dashboard, settings, activity, worklog, profile, people, apps,
 * meetings, admin — nine copies of the same two class strings, and /progress
 * a tenth that dropped one orb and nudged the other).
 *
 * Server-safe on purpose: it is pure decoration with no state, so making it
 * a client component would ship JS for a background.
 *
 * The parent must be `relative` — the wrapper pins to its box and clips the
 * negative offsets itself, so a page adopting this no longer needs its own
 * `overflow-hidden` just to keep the orbs off the scrollbar.
 */
type AmbientVariant = 'default' | 'single'

/**
 * Both variants are transcriptions of what is already in the tree, not new
 * art: `default` is the twin-orb arrangement on the dashboard, `single` is
 * the quieter one-orb version /progress uses so a dense data table is not
 * read through two washes of colour.
 */
const ORBS: Record<AmbientVariant, readonly string[]> = {
  default: [
    'absolute -top-40 right-1/4 h-[450px] w-[600px] rounded-full bg-primary/8 blur-3xl',
    'absolute top-1/2 -left-40 h-[400px] w-[500px] rounded-full bg-chart-1/5 blur-3xl',
  ],
  single: [
    'absolute -top-40 right-1/3 h-[400px] w-[500px] rounded-full bg-primary/8 blur-3xl',
  ],
}

function AmbientBackdrop({
  variant = 'default',
  className,
}: {
  variant?: AmbientVariant
  className?: string
}) {
  return (
    <div
      data-slot="ambient-backdrop"
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      {ORBS[variant].map((orb) => (
        <div key={orb} className={orb} />
      ))}
    </div>
  )
}

export { AmbientBackdrop, type AmbientVariant }
