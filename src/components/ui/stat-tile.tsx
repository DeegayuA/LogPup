import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * A stat that goes somewhere.
 *
 * Data values are mono and tabular so a column of them lines up on the
 * decimal, and sized by the type scale rather than by emphasis: a number is
 * not more important for being bigger, and a row of tiles shouting at one
 * another has no hierarchy at all. Weight and colour carry rank; size stays
 * put.
 *
 * The label carries the meaning in WORDS — tone tints the value but never
 * replaces the label, so nothing is lost to a colourblind reader.
 */
type StatTone = "default" | "attention" | "positive" | "destructive"

const TONE_TEXT: Record<StatTone, string> = {
  default: "text-foreground",
  attention: "text-chart-1",
  positive: "text-primary",
  destructive: "text-destructive",
}

const TONE_BG: Record<StatTone, string> = {
  default: "hover:border-border/80 hover:bg-muted/40",
  attention: "hover:border-chart-1/50 hover:bg-chart-1/5",
  positive: "hover:border-primary/50 hover:bg-primary/5",
  destructive: "hover:border-destructive/50 hover:bg-destructive/5",
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
  meta?: React.ReactNode
  tone?: StatTone
  href?: string
  className?: string
}) {
  const body = (
    <>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
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
    // Named properties, never `all`: a tile animating `all` also animates its
    // own layout when a neighbour's value changes width, which is the jitter
    // this row is most prone to. Only colour and elevation move on hover.
    "flex min-w-0 flex-col gap-1 rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-xs backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
    className
  )

  if (href) {
    return (
      <Link
        href={href}
        data-slot="stat-tile"
        className={cn(
          shared,
          "outline-none cursor-pointer focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
          TONE_BG[tone]
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
