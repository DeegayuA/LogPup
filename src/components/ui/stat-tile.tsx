import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * A stat that goes somewhere. The dashboard's "Overdue 3" tiles were static
 * <dl> entries — a number that names a problem but won't take you to it.
 * StatTile renders as a Link when `href` is given, with the repo's standard
 * focus ring, so every count is also the shortest path to its rows.
 *
 * Numbers are mono/tabular (they align in a row of tiles); the label carries
 * the meaning in WORDS — tone tints the value but never replaces the label,
 * so a colorblind reader loses nothing (WCAG 1.4.1).
 */
type StatTone = "default" | "attention" | "positive" | "destructive"

const TONE_TEXT: Record<StatTone, string> = {
  default: "text-foreground",
  attention: "text-chart-1",
  positive: "text-success",
  destructive: "text-destructive",
}

function StatTile({
  label,
  value,
  meta,
  tone = "default",
  href,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  /** One quiet line under the value — a worded delta ("2 more than Monday"),
   *  never a bare arrow or color-only signal. */
  meta?: React.ReactNode
  tone?: StatTone
  href?: string
  className?: string
}) {
  const body = (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-lg font-semibold tabular-nums leading-tight",
          TONE_TEXT[tone]
        )}
      >
        {value}
      </dd>
      {meta ? <dd className="text-2xs text-muted-foreground">{meta}</dd> : null}
    </>
  )

  const shared = cn(
    "flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2",
    className
  )

  if (href) {
    return (
      <Link
        href={href}
        data-slot="stat-tile"
        className={cn(
          shared,
          "outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        )}
      >
        <dl className="contents">{body}</dl>
      </Link>
    )
  }

  return (
    <dl data-slot="stat-tile" className={shared}>
      {body}
    </dl>
  )
}

export { StatTile }
