/**
 * Backdrop art for the sign-in brand panel: luxury topographic contours and radar rings,
 * evoking the terrain LogPup keeps watch over.
 *
 * Rendered with high contrast and smooth breathing animation.
 */
const RINGS = Array.from({ length: 9 }, (_, index) => {
  const step = index / 8
  return {
    rx: 130 + step * 420,
    ry: 100 + step * 320,
    rotate: -16 + step * 8,
    opacity: 0.65 - step * 0.35, // ranges from 0.65 down to 0.30 (crisp and visible)
    duration: `${14 + index * 1.2}s`,
    delay: `${index * 0.4}s`,
  }
})

type RingVars = React.CSSProperties & {
  '--ring-duration': string
  '--ring-delay': string
  '--ring-opacity': string
}

export function SignInBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 size-full overflow-hidden">
      {/* Top right ambient glow */}
      <div className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      {/* Bottom left ambient glow */}
      <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-chart-1/15 blur-3xl" />

      <svg
        aria-hidden
        className="absolute inset-0 size-full text-primary"
        viewBox="0 0 900 1200"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {/* Top-Right Orbital Radar Cluster */}
        <g transform="translate(640 280)">
          {RINGS.map((ring) => (
            <g key={ring.rx} transform={`rotate(${ring.rotate})`}>
              <ellipse
                className="ring-breathe"
                style={
                  {
                    '--ring-duration': ring.duration,
                    '--ring-delay': ring.delay,
                    '--ring-opacity': String(ring.opacity),
                  } as RingVars
                }
                rx={ring.rx}
                ry={ring.ry}
                stroke="currentColor"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                opacity={ring.opacity}
              />
            </g>
          ))}
        </g>

        {/* Bottom-Left Orbital Radar Cluster */}
        <g transform="translate(120 1000)">
          {RINGS.slice(0, 6).map((ring) => (
            <g key={ring.rx} transform={`rotate(${-ring.rotate})`}>
              <ellipse
                className="ring-breathe"
                style={
                  {
                    '--ring-duration': ring.duration,
                    '--ring-delay': `-${parseFloat(ring.duration) / 2}s`,
                    '--ring-opacity': String(ring.opacity * 0.85),
                  } as RingVars
                }
                rx={ring.rx * 0.6}
                ry={ring.ry * 0.6}
                stroke="currentColor"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                opacity={ring.opacity * 0.85}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
