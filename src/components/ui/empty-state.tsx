import { cn } from "@/lib/utils"

/**
 * The one empty-state shape: icon, message, and — non-negotiable — a next
 * action. An empty list that only announces its emptiness is a dead end;
 * the action slot is what turns "nothing here" into "here's how something
 * gets here". ~14 hand-rolled variants across features converge on this.
 *
 * Deliberately quiet: muted icon, sm text, no card chrome of its own — it
 * inherits the container it empties, so it never shouts louder than real
 * content would have.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ComponentType<{ className?: string }>
  title: React.ReactNode
  description?: React.ReactNode
  /** The next action — a Button, a Link, or palette hint. Omit only when the
   *  emptiness is genuinely terminal (e.g. a permission wall). */
  action?: React.ReactNode
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center",
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="mb-1 size-5 text-muted-foreground/70" aria-hidden /> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
