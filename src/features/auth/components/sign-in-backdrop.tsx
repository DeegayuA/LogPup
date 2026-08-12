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
    // Outer rings breathe slower and start later, so the pulse reads as one
    // wave travelling outward rather than eleven ellipses throbbing in unison.
    // Periods are deliberately non-harmonic (13s, 14.1s, 15.2s …) — equal or
    // multiple durations re-sync every few cycles into a visible heartbeat.
    duration: `${13 + index * 1.1}s`,
    delay: `${index * 0.42}s`,
  }
})

// Custom properties the .ring-breathe utility in globals.css reads. Declared
// as a type because React's CSSProperties has no slot for custom properties.
type RingVars = React.CSSProperties & {
  '--ring-duration': string
  '--ring-delay': string
}

export function SignInBackdrop() {
  return (
    <svg
      aria-hidden
      // Slower and quieter than the text sequence so the contours settle in
      // behind the content instead of competing with it for attention.
      className="pointer-events-none absolute inset-0 size-full text-primary motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-1000 motion-safe:ease-out"
      viewBox="0 0 900 1200"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {/* The static rotate lives on a wrapping <g> in both clusters: a CSS
          `transform` on the ellipse itself would replace the presentation
          attribute outright, flattening every ring back to zero degrees the
          moment the animation applied. */}
      <g transform="translate(640 300)">
        {RINGS.map((ring) => (
          <g key={ring.rx} transform={`rotate(${ring.rotate})`}>
            <ellipse
              className="ring-breathe"
              style={
                { '--ring-duration': ring.duration, '--ring-delay': ring.delay } as RingVars
              }
              rx={ring.rx}
              ry={ring.ry}
              stroke="currentColor"
              strokeWidth={1.25}
              opacity={ring.opacity}
            />
          </g>
        ))}
      </g>
      <g transform="translate(120 980)">
        {RINGS.slice(0, 7).map((ring) => (
          <g key={ring.rx} transform={`rotate(${-ring.rotate})`}>
            <ellipse
              className="ring-breathe"
              // Counter-phase against the top cluster — offsetting the delay by
              // half a period keeps the two corners from pulsing together, which
              // is what would make the whole panel look like it is beating.
              style={
                {
                  '--ring-duration': ring.duration,
                  '--ring-delay': `-${parseFloat(ring.duration) / 2}s`,
                } as RingVars
              }
              rx={ring.rx * 0.62}
              ry={ring.ry * 0.62}
              stroke="currentColor"
              strokeWidth={1.25}
              opacity={ring.opacity * 0.8}
            />
          </g>
        ))}
      </g>
    </svg>
  )
}
