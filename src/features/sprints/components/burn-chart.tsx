'use client'

import { useId, useState } from 'react'
import { format } from 'date-fns'
import type { BurnPoint } from '@/features/sprints/sprint-metrics'

/**
 * Burndown or burnup for one sprint. Hand-drawn SVG rather than a chart
 * library: two lines and an axis do not justify a dependency.
 *
 * Two series — the real line (primary, solid, 2px) and the reference line
 * (muted, dashed) — so a legend is always shown and identity never rides on
 * colour alone (dash pattern + label). Hover snaps a crosshair to the nearest
 * day; the same numbers are in the table under the chart for anyone not
 * using a pointer.
 */

const W = 560
const H = 200
const PAD = { top: 12, right: 12, bottom: 24, left: 36 }

function dayLabel(iso: string) {
  return format(new Date(`${iso}T12:00:00`), 'MMM d')
}

export function BurnChart({ data, mode }: { data: BurnPoint[]; mode: 'down' | 'up' }) {
  const [hover, setHover] = useState<number | null>(null)
  const titleId = useId()
  if (data.length === 0) return null

  const scope = data[0].ideal
  const actual = data.map((d) => (mode === 'down' ? d.remaining : d.completed))
  const reference = data.map((d) => (mode === 'down' ? d.ideal : scope))
  const top = Math.max(1, scope, ...actual.map((v) => v ?? 0))

  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2)
  const y = (v: number) => PAD.top + ih - (v / top) * ih

  const line = (values: (number | null)[]) =>
    values
      .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(' ')

  const ticks = [0, Math.round(top / 2), Math.round(top)]
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))
  const actualName = mode === 'down' ? 'Remaining' : 'Completed'
  const referenceName = mode === 'down' ? 'Ideal' : 'Scope'
  const h = hover !== null ? data[hover] : null

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-2xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" className="stroke-primary" strokeWidth="2" /></svg>
          {actualName}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
          {referenceName}
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby={titleId}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const px = ((event.clientX - rect.left) / rect.width) * W
            const i = Math.round(((px - PAD.left) / iw) * (data.length - 1))
            setHover(Math.min(data.length - 1, Math.max(0, i)))
          }}
        >
          <title id={titleId}>
            {`${mode === 'down' ? 'Burndown' : 'Burnup'}: ${actualName.toLowerCase()} points per day against the ${referenceName.toLowerCase()} line`}
          </title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {dayLabel(d.day)}
              </text>
            ) : null,
          )}
          <polyline points={line(reference)} fill="none" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 3" />
          <polyline points={line(actual)} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null ? (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="stroke-muted-foreground" strokeWidth="1" />
              {actual[hover] !== null ? (
                <circle cx={x(hover)} cy={y(actual[hover] as number)} r="4" className="fill-primary stroke-card" strokeWidth="2" />
              ) : null}
            </>
          ) : null}
        </svg>
        {h && hover !== null ? (
          <div
            className="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-2xs text-popover-foreground shadow-sm"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: hover > data.length / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
            }}
          >
            <div className="font-medium">{dayLabel(h.day)}</div>
            <div className="tabular-nums">
              {actualName}: {actual[hover] ?? '—'} pts
            </div>
            <div className="tabular-nums text-muted-foreground">
              {referenceName}: {reference[hover]} pts
            </div>
          </div>
        ) : null}
      </div>
      <details className="text-2xs text-muted-foreground">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="text-left">
              <th className="font-medium">Day</th>
              <th className="font-medium">{actualName}</th>
              <th className="font-medium">{referenceName}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.day}>
                <td>{dayLabel(d.day)}</td>
                <td>{actual[i] ?? '—'}</td>
                <td>{reference[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
