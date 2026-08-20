import { cn } from "@/lib/utils"

/**
 * The h1 row every (app) page starts with: title, optional description,
 * optional actions pinned to the end. One component so heading order stops
 * drifting per page (several pages styled their h1 ad hoc; /pending shipped
 * with none at all) and so page actions land in the same place everywhere.
 *
 * Actions wrap UNDER the title on narrow screens rather than squeezing it —
 * the title is the page's identity and never truncates to fit a button.
 */
function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: React.ComponentProps<"header"> & {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

export { PageHeader }
