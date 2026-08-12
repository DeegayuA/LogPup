import Image from 'next/image'

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
 */
export function AltaVisionLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/altavision-logo.webp"
      alt="Alta Vision"
      width={264}
      height={42}
      className={className}
    />
  )
}
