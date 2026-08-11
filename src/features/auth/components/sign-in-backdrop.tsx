/**
 * Backdrop art for the sign-in brand panel: quiet topographic contours, the
 * terrain LogPup keeps watch over.
 *
 * Drawn inline (not a file in public/) so every stroke is `currentColor` and
 * the art re-tints itself for light and dark instead of shipping two assets.
 *
 * To use a photo instead: drop it in `public/` and swap this component for
 *   <Image src="/your-photo.jpg" alt="" fill priority className="object-cover" />
 * plus a readability scrim (`absolute inset-0 bg-sidebar/80`) so the headline
 * and capability list keep their contrast.
 */
const RINGS = Array.from({ length: 11 }, (_, index) => {
  const step = index / 10
  return {
    rx: 120 + step * 460,
    ry: 96 + step * 330,
    rotate: -18 + step * 10,
    // Fades outward so the panel edge stays calm and the text sits on the
    // quietest part of the drawing.
    opacity: 0.5 - step * 0.34,
  }
})

export function SignInBackdrop() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full text-primary"
      viewBox="0 0 900 1200"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <g transform="translate(640 300)">
        {RINGS.map((ring) => (
          <ellipse
            key={ring.rx}
            rx={ring.rx}
            ry={ring.ry}
            transform={`rotate(${ring.rotate})`}
            stroke="currentColor"
            strokeWidth={1.25}
            opacity={ring.opacity}
          />
        ))}
      </g>
      <g transform="translate(120 980)">
        {RINGS.slice(0, 7).map((ring) => (
          <ellipse
            key={ring.rx}
            rx={ring.rx * 0.62}
            ry={ring.ry * 0.62}
            transform={`rotate(${-ring.rotate})`}
            stroke="currentColor"
            strokeWidth={1.25}
            opacity={ring.opacity * 0.8}
          />
        ))}
      </g>
    </svg>
  )
}
