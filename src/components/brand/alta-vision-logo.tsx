import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Alta Vision corporate mark — the company that builds and operates LogPup.
 * It appears twice over: on the public pages Google's OAuth reviewer visits
 * (/home, /privacy, /terms), where brand verification looks for one consistent
 * identity across the app, the consent screen, and the site; and inside the app
 * shell, alongside — never instead of — the LogPup paw.
 *
 * Source is the official flat mark from altavision.lk, 3774x607 with an alpha
 * channel. That transparency is what lets one file sit on both the light stone
 * and the dark pine sidebar without a white plate behind it, so replacing it
 * with a flattened export would break dark mode. width/height below are the
 * same 6.22:1 ratio scaled down — they set the aspect box, and callers pick the
 * real size with an `h-*` class.
 *
 * The dark-mode brightness lift is not decoration. Alta Vision publishes one
 * flat mark drawn for light backgrounds: its grey pyramid is #6f7878, which on
 * the dark sidebar measures 4.5:1 — over the 3:1 floor WCAG 1.4.11 sets for
 * graphical objects, but visibly murky, and the /70 opacity these callers use
 * for hierarchy drags it under. 1.3 puts the grey at #909c9c (7.2:1) while the
 * teal only moves #308a72 -> #3eb394, still plainly the brand green; 1.45 was
 * measurably brighter but pushed the teal toward mint, which is a worse trade
 * for a logo than a slightly dimmer grey. A per-theme asset would beat both,
 * but Alta Vision doesn't publish one.
 */
export function AltaVisionLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/altavision-logo.webp"
      alt="Alta Vision"
      width={264}
      height={42}
      className={cn('dark:brightness-[1.3]', className)}
    />
  )
}
