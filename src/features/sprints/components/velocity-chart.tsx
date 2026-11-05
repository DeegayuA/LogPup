'use client'

import { useId, useState } from 'react'
import type { VelocityEntry } from '@/features/sprints/sprint-metrics'

/**
 * Completed points per finished sprint, one bar each, with the average as a
 * dashed rule. One series, so no legend box: the heading names it. Bars get
 * 4px rounded tops and a hit target the full column tall.
 */

const W = 560
const H = 180
const PAD = { top: 16, right: 12, bottom: 24, left: 36 }

export function VelocityChart({ entries, average }: { entries: VelocityEntry[]; average: number | null }) {
  const [hover, setHover] = useState<number | null>(null)
  const titleId = useId()
  if (entries.length === 0) return null

  const top = Math.max(1, ...entries.map((e) => e.completedPoints))
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const slot = iw / entries.length
  const bar = Math.min(48, slot * 0.6)
  const y = (v: number) => PAD.top + ih - (v / top) * ih

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={titleId} onPointerLeave={() => setHover(null)}>
          <title id={titleId}>
            {`Velocity: ${entries.map((e) => `${e.name} ${e.completedPoints} points`).join(', ')}`}
          </title>
          {[0, Math.round(top / 2), Math.round(top)].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {entries.map((e, i) => {
            const cx = PAD.left + slot * i + slot / 2
            const h = Math.max(0, PAD.top + ih - y(e.completedPoints))
            const r = Math.min(4, h / 2, bar / 2)
            const x0 = cx - bar / 2
            const y0 = PAD.top + ih - h
            return (
              <g key={e.sprintId} onPointerEnter={() => setHover(i)}>
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={ih} fill="transparent" />
                {h > 0 ? (
                  <path
                    d={`M${x0},${y0 + h} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + bar - r} Q${x0 + bar},${y0} ${x0 + bar},${y0 + r} V${y0 + h} Z`}
                    className={hover === i ? 'fill-primary' : 'fill-primary/80'}
                  />
                ) : null}
                <text x={cx} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {e.name.length > 12 ? `${e.name.slice(0, 11)}…` : e.name}
                </text>
              </g>
            )
          })}
          {average !== null ? (
            <line x1={PAD.left} x2={W - PAD.right} y1={y(average)} y2={y(average)} className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 3" />
          ) : null}
        </svg>
        {hover !== null ? (
          <div
            className="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-2xs text-popover-foreground shadow-sm"
            style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <div className="font-medium">{entries[hover].name}</div>
            <div className="tabular-nums">{entries[hover].completedPoints} pts done</div>
          </div>
        ) : null}
      </div>
      {average !== null ? (
        <figcaption className="text-2xs text-muted-foreground">
          Dashed line: average {average} pts over the last {entries.length} finished sprint{entries.length === 1 ? '' : 's'}.
        </figcaption>
      ) : null}
    </figure>
  )
}
