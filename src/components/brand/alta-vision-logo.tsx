import Image from 'next/image'

/**
 * Alta Vision corporate mark. It appears on the public pages Google's OAuth
 * reviewer actually visits (/home, /privacy, /terms), which is where brand
 * verification looks for a consistent identity between the app, the consent
 * screen, and the site.
 *
 * `unoptimized` is deliberate: the file is an SVG, and routing it through the
 * Next image optimizer would need `dangerouslyAllowSVG` in next.config.ts —
 * a global relaxation not worth taking for one static mark.
 */
export function AltaVisionLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/altavision-logo.svg"
      alt="Alta Vision"
      width={132}
      height={24}
      unoptimized
      className={className}
    />
  )
}
